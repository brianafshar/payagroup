import hashlib
import re
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from core.uploads import photo_upload_to, validate_photo


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, username, password=None, **extra):
        """Accounts sign in with a username. A username that looks like an e-mail address is also kept as the
        (optional) contact e-mail so the admin e-mail flows keep working."""
        if not username:
            raise ValueError("Username is required")
        username = username.strip().lower()
        if "@" in username:
            extra.setdefault("email", username)
        user = self.model(username=username, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra):
        extra.update(role=User.Role.ADMIN, admin_role=User.AdminRole.SUPER, is_staff=True, is_superuser=True)
        return self.create_user(username, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """One login for every role. Coaches and athletes have a profile (`user.coach` / `user.athlete`)."""

    class Role(models.TextChoices):
        ADMIN = "admin", "مدیر"
        COACH = "coach", "مربی"
        ATHLETE = "athlete", "ورزشکار"

    class AdminRole(models.TextChoices):
        SUPER = "super", "مدیر ارشد"
        SUPPORT = "support", "مدیر پشتیبانی"

    class Theme(models.TextChoices):
        LIGHT = "light"
        DARK = "dark"
        SYSTEM = "system"

    username = models.CharField(max_length=150, unique=True, help_text="Sign-in name.")
    email = models.EmailField(blank=True, help_text="Optional contact e-mail (not used to sign in).")
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=10, choices=Role.choices)
    admin_role = models.CharField(max_length=10, choices=AdminRole.choices, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    photo = models.ImageField(upload_to=photo_upload_to, blank=True, validators=[validate_photo])
    theme = models.CharField(max_length=6, choices=Theme.choices, default=Theme.SYSTEM)
    two_factor = models.BooleanField(default=False)
    # TOTP (RFC 6238). The pending secret holds a setup that hasn't been confirmed with a code yet.
    totp_secret = models.CharField(max_length=64, blank=True)
    totp_pending_secret = models.CharField(max_length=64, blank=True)
    totp_last_step = models.BigIntegerField(null=True, blank=True, help_text="Last accepted time step (replay protection).")
    recovery_codes = models.JSONField(default=list, blank=True, help_text="SHA-256 hashes of unused recovery codes.")
    force_password_change = models.BooleanField(default=False)
    # Incremented to end every session of the user (password change, deactivation). Tokens carry it.
    session_epoch = models.PositiveIntegerField(default=0)
    notifications_seen_at = models.DateTimeField(null=True, blank=True, help_text="Top-bar notifications newer than this are unread.")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.username})"

    def save(self, *args, **kwargs):
        # Admins created in Django admin without an admin role would otherwise have no panel permissions.
        if self.role == self.Role.ADMIN and not self.admin_role:
            self.admin_role = self.AdminRole.SUPER if self.is_superuser else self.AdminRole.SUPPORT
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = {*kwargs["update_fields"], "admin_role"}
        super().save(*args, **kwargs)

    @property
    def pending(self) -> bool:
        """Invited but has not set a password yet."""
        return not self.has_usable_password()

    def end_sessions(self, by: str = "admin") -> None:
        self.session_epoch += 1
        self.save(update_fields=["session_epoch"])
        self.login_sessions.filter(ended_at__isnull=True).update(ended_at=timezone.now(), ended_by=by)
        self.notify_sessions_ended()

    def notify_sessions_ended(self) -> None:
        """Close this user's open WebSockets and forget their push tokens."""
        from messaging.models import Device
        from messaging.realtime import send_to_users

        Device.objects.filter(user=self).delete()
        send_to_users([self.pk], {"type": "session.end"})

    @property
    def mfa_required(self) -> bool:
        """Whether the platform policy (A08 › Security) requires 2FA for this user's role."""
        from core.models import PlatformSettings

        if self.role == self.Role.ADMIN:
            return PlatformSettings.load().require_admin_2fa
        if self.role == self.Role.COACH:
            return PlatformSettings.load().require_coach_2fa
        return False

    @property
    def mfa_setup_required(self) -> bool:
        """Required by policy but not set up yet: only the auth endpoints work until it is."""
        return not self.two_factor and self.mfa_required

    def sign_in_block_reason(self) -> str | None:
        """Why this user may not use the API right now (None = allowed)."""
        if not self.is_active:
            return "inactive"
        if self.role == self.Role.COACH:
            coach = getattr(self, "coach", None)
            if coach is None or coach.effective_status != "active":
                return "coach_inactive"
        if self.role == self.Role.ATHLETE:
            athlete = getattr(self, "athlete", None)
            if athlete is None or athlete.status != "active":
                return "athlete_inactive"
        return None


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class TokenQuerySet(models.QuerySet):
    def usable(self):
        return self.filter(used_at__isnull=True, expires_at__gt=timezone.now())

    def by_token(self, token: str):
        return self.filter(token_hash=_hash(token))


class OneTimeToken(models.Model):
    """Single-use link token. Only the SHA-256 hash is stored; the raw token exists in the link only."""

    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    objects = TokenQuerySet.as_manager()

    LIFETIME = timedelta(days=1)
    PATH = ""

    class Meta:
        abstract = True

    @classmethod
    def issue(cls, created_by=None, **fields):
        """Create a token; returns `(instance, raw_token)`."""
        raw = secrets.token_urlsafe(32)
        obj = cls.objects.create(token_hash=_hash(raw), expires_at=timezone.now() + cls.LIFETIME, created_by=created_by, **fields)
        return obj, raw

    @classmethod
    def url_for(cls, raw: str) -> str:
        return f"{settings.FRONTEND_URL}/{cls.PATH}/{raw}"

    @property
    def expired(self) -> bool:
        return self.expires_at <= timezone.now()

    @property
    def usable(self) -> bool:
        return self.used_at is None and not self.expired

    def consume(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])


class Invite(OneTimeToken):
    """Invite link: valid 7 days, single use. Issuing a new one revokes the previous ones for that person."""

    class Kind(models.TextChoices):
        ADMIN = "admin"
        COACH = "coach"
        ATHLETE = "athlete"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    email = models.EmailField()
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="invites")
    athlete = models.ForeignKey("coaching.Athlete", null=True, blank=True, on_delete=models.CASCADE, related_name="invites")

    LIFETIME = timedelta(days=7)
    PATH = "invite"

    class Meta:
        ordering = ["-created_at"]


class ResetToken(OneTimeToken):
    """Password reset link: valid 24 hours, single use."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reset_tokens")

    LIFETIME = timedelta(hours=24)
    PATH = "reset"

    class Meta:
        ordering = ["-created_at"]


class LoginSession(models.Model):
    """One sign-in on one device (browser or app install). Its id travels in the JWTs as `sid`, so ending
    it — by the user from another device or by an admin — stops that device only: its tokens are
    refused, its live socket closes and its push registration is removed. Signing in is never limited."""

    class Client(models.TextChoices):
        PANEL = "panel"  # coach / admin web panel
        APP_ANDROID = "app-android"
        APP_IOS = "app-ios"
        APP_WEB = "app-web"  # athlete web app (PWA)
        OTHER = "other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_sessions")
    client = models.CharField(max_length=12, choices=Client.choices, default=Client.OTHER)
    user_agent = models.CharField(max_length=300, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.CharField(max_length=10, blank=True, help_text="logout, self, admin, password")

    class Meta:
        ordering = ["-last_seen_at"]
        indexes = [models.Index(fields=["user", "ended_at"])]

    @property
    def active(self) -> bool:
        """Not ended, and used within the refresh token lifetime (later its tokens can't be refreshed)."""
        life = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
        return self.ended_at is None and self.last_seen_at > timezone.now() - life

    @property
    def device(self) -> str:
        """Short label like «Chrome · Windows» or «اپ اندروید» from the client and user agent."""
        if self.client == self.Client.APP_ANDROID:
            return "اپ اندروید"
        if self.client == self.Client.APP_IOS:
            return "اپ آیفون"
        ua = self.user_agent
        os_ = next((n for p, n in OS_PATTERNS if re.search(p, ua)), "")
        br = next((n for p, n in BROWSER_PATTERNS if re.search(p, ua)), "")
        label = " · ".join(x for x in (br, os_) if x) or "دستگاه ناشناس"
        return ("اپ وب · " if self.client == self.Client.APP_WEB else "") + label


OS_PATTERNS = [
    (r"Android", "Android"),
    (r"iPhone|iPad|iPod", "iOS"),
    (r"Windows", "Windows"),
    (r"Mac OS X|Macintosh", "macOS"),
    (r"Linux", "Linux"),
]
BROWSER_PATTERNS = [
    (r"Edg/", "Edge"),
    (r"OPR/|Opera", "Opera"),
    (r"SamsungBrowser", "Samsung Internet"),
    (r"Firefox/", "Firefox"),
    (r"Chrome/", "Chrome"),
    (r"Safari/", "Safari"),
]


PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"  # no look-alikes (0/O, 1/l/I)


def random_password(length: int = 10) -> str:
    """Random password of letters and digits, always with at least one of each (e.g. `Hq7mR2xkTa`)."""
    while True:
        pw = "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(length))
        if any(c.isdigit() for c in pw) and any(c.isalpha() for c in pw):
            return pw
