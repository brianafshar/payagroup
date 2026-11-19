import math
from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone

from core.uploads import document_upload_to, logo_upload_to, validate_document, validate_logo


def program_week_of(start, day) -> int:
    """Program week of `day` for a program started on `start`: weeks are counted from the start day, so a
    program started on a Friday has week 1 = that Friday → next Thursday and runs its full length (#61).
    Each day still runs the session written for its weekday (Friday's session on Fridays). The coach picks
    the start: today, or the next Saturday for calendar-aligned weeks."""
    return (day - start).days // 7 + 1


class AccountStatus(models.TextChoices):
    ACTIVE = "active", "فعال"
    INACTIVE = "inactive", "غیرفعال"
    INVITED = "invited", "دعوت‌شده"
    DRAFT = "draft", "پیش‌نویس"
    PAUSED = "paused", "متوقف"


HEX_COLOR = RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use a #RRGGBB color.")


class Coach(models.Model):
    """A coach workspace: white-label branding, athlete cap and account validity (A03–A05, A07)."""

    class Cadence(models.TextChoices):
        WEEKLY = "weekly"
        EVERY_N_WEEKS = "every-n-weeks"
        MONTHLY = "monthly"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="coach")
    status = models.CharField(max_length=10, choices=AccountStatus.choices, default=AccountStatus.DRAFT)
    sport = models.CharField(max_length=40, default="fitness")
    bio = models.TextField(blank=True)

    # Head coach (سرمربی): a coach who also supervises other coaches. Coaches of one gym share the exercise
    # library, program templates and tests; a head coach also sees every athlete of the coaches under them.
    is_head = models.BooleanField(default=False)
    head = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="team")

    # Branding (white-label)
    app_name = models.CharField(max_length=60)
    initials = models.CharField(max_length=3, blank=True)
    logo = models.FileField(upload_to=logo_upload_to, blank=True, validators=[validate_logo])
    primary = models.CharField(max_length=7, default="#FF9A1F", validators=[HEX_COLOR])
    secondary = models.CharField(max_length=7, default="#111418", validators=[HEX_COLOR])
    theme = models.CharField(max_length=40, blank=True, help_text="Registered white-label theme key (data-theme).")

    # Limits & validity
    athlete_cap = models.PositiveIntegerField(null=True, blank=True, help_text="Empty = unlimited.")
    validity_days = models.PositiveIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(1095)], help_text="Empty = unlimited."
    )
    activated_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    reminder_days = models.PositiveSmallIntegerField(default=2, choices=[(1, "1"), (2, "2"), (3, "3"), (7, "7")])
    reminder_sent_for = models.DateTimeField(null=True, blank=True, help_text="expires_at value the reminder was sent for.")

    # Chat (C33): no push notifications to athletes between 22:00 and 07:00 (messages still arrive).
    quiet_hours = models.BooleanField(default=True)
    # C32 settings without their own columns: public profile (city, years, specialties, links),
    # notification choices, units, measurement-day defaults… Validated as a JSON object.
    preferences = models.JSONField(default=dict, blank=True)

    # Measurement cadence (C32)
    cadence = models.CharField(max_length=15, choices=Cadence.choices, default=Cadence.WEEKLY)
    cadence_weeks = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(2), MaxValueValidator(12)])

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user.name} ({self.app_name})"

    def save(self, *args, **kwargs):
        if not self.initials:
            self.initials = "".join(w[0].upper() for w in self.app_name.split()[:2] if w)
        super().save(*args, **kwargs)

    @property
    def expired(self) -> bool:
        return self.expires_at is not None and self.expires_at <= timezone.now()

    @property
    def effective_status(self) -> str:
        """A limited account past its end date is inactive even before the expiry job runs."""
        if self.status == AccountStatus.ACTIVE and self.expired:
            return AccountStatus.INACTIVE
        return self.status

    @property
    def days_left(self) -> int | None:
        if self.expires_at is None:
            return None
        return math.ceil(max(0.0, (self.expires_at - timezone.now()).total_seconds()) / 86400)

    def activate(self) -> None:
        """Start (or restart after expiry) the validity window; data is retained across deactivation."""
        now = timezone.now()
        self.status = AccountStatus.ACTIVE
        self.activated_at = self.activated_at or now
        if self.validity_days and (self.expires_at is None or self.expires_at <= now):
            self.expires_at = now + timedelta(days=self.validity_days)

    def extend(self, days: int) -> None:
        """Extend from the later of now and the current end date; reactivates an expired account."""
        if self.validity_days is None:
            return
        base = max(timezone.now(), self.expires_at or timezone.now())
        self.expires_at = base + timedelta(days=days)
        if self.status == AccountStatus.INACTIVE:
            self.status = AccountStatus.ACTIVE

    def in_quiet_hours(self, now=None) -> bool:
        hour = timezone.localtime(now).hour
        return self.quiet_hours and (hour >= 22 or hour < 7)

    @property
    def gym_head(self) -> "Coach":
        return self if self.is_head or self.head_id is None else self.head

    def gym_ids(self) -> list[int]:
        """Coaches sharing this coach's library: the head coach and everyone under them (just self if standalone)."""
        h = self.gym_head
        if not h.is_head:
            return [self.pk]
        return [h.pk, *h.team.values_list("pk", flat=True)]

    def athlete_scope_ids(self) -> list[int]:
        """Coaches whose athletes this coach may open: a head coach sees the whole team, a coach only their own."""
        return self.gym_ids() if self.is_head else [self.pk]

    @property
    def athlete_count(self) -> int:
        return self.athletes.exclude(status=AccountStatus.INACTIVE).count()


class TestDefinition(models.Model):
    """Coach-defined performance test (C32), used in endurance & speed analytics (C28)."""

    class Better(models.TextChoices):
        HIGHER = "higher"
        LOWER = "lower"

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name="tests")
    name = models.CharField(max_length=80)
    category = models.CharField(max_length=16, blank=True, help_text="str · spd · end · pow · mob · agi · other")
    unit = models.CharField(max_length=16)
    better = models.CharField(max_length=6, choices=Better.choices, default=Better.HIGHER)
    protocol = models.TextField(blank=True, help_text="How to run the test (warm-up, distance, rest…), shown when logging it.")

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["coach", "name"], name="unique_test_name_per_coach")]

    def __str__(self) -> str:
        return self.name


class Athlete(models.Model):
    """An athlete of one coach. `user` is set once the athlete accepts the invite (draft athletes have none)."""

    class Goal(models.TextChoices):
        LOSS = "loss", "کاهش وزن"
        GAIN = "gain", "عضله‌سازی"
        STRENGTH = "str", "قدرت"
        GENERAL = "gen", "آمادگی عمومی"

    class Gender(models.TextChoices):
        FEMALE = "f", "زن"
        MALE = "m", "مرد"
        OTHER = "x", "ترجیح می‌دهم نگویم"

    coach = models.ForeignKey(Coach, on_delete=models.PROTECT, related_name="athletes")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="athlete")
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=10, choices=AccountStatus.choices, default=AccountStatus.DRAFT)
    goal = models.CharField(max_length=4, choices=Goal.choices, blank=True)
    gender = models.CharField(max_length=1, choices=Gender.choices, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    max_hr = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Measured max heart rate; otherwise estimated from age (208 − 0.7 × age).")
    sport = models.CharField(max_length=40, blank=True)
    # Main assigned program (an athlete copy) and when its week 1 started. More programs can run alongside
    # it (`Program.active`, #74); see `active_programs()`.
    program = models.ForeignKey("training.Program", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    program_start = models.DateField(null=True, blank=True)
    # Body composition (C29): target weight, and the measurement schedule when it differs from the coach's
    # default (`coach.preferences["m"]`): {freq: w1|w2|w3|m1|custom, n, day: sa…fr, remind, req: [metric keys]}.
    goal_weight_kg = models.FloatField(null=True, blank=True)
    measure_schedule = models.JSONField(null=True, blank=True)
    key_lifts = models.JSONField(
        default=list, blank=True, help_text="Exercise ids the coach picked for the strength analytics; empty = the most-trained lifts."
    )
    last_active_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def active_programs(self) -> list:
        """Programs the athlete follows now, the main one first (#74)."""
        from training.models import Program

        progs = list(Program.objects.filter(athlete=self, active=True, archived=False).order_by("start_date", "id"))
        progs.sort(key=lambda p: p.pk != self.program_id)
        return progs

    @property
    def program_week(self) -> int | None:
        if not self.program_id or not self.program_start:
            return None
        return program_week_of(self.program_start, timezone.localdate())

    @property
    def height_cm(self):
        """Height lives with body measurements (M42); this is the latest recorded value."""
        m = self.measurements.filter(metric="height").order_by("-date", "-id").first()
        return m.value if m else None


class HealthProfile(models.Model):
    """Athlete health profile (M46). Never exposed to admin roles; coach access is audit-logged."""

    athlete = models.OneToOneField(Athlete, on_delete=models.CASCADE, primary_key=True, related_name="health")
    conditions = models.TextField(blank=True)
    injuries = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    allergies = models.TextField(blank=True)
    limitations = models.TextField(blank=True)
    history = models.TextField(blank=True)
    note = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")


class AthleteNote(models.Model):
    """The coach's private notes about an athlete (C12 › یادداشت‌ها). Never shown to the athlete."""

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ProgramShare(models.Model):
    """A program PDF sent to an athlete by SMS: the public link and whether the SMS went out."""

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="shares")
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    token = models.CharField(max_length=64, unique=True)
    url = models.URLField(max_length=500)
    pdf = models.FileField(upload_to="shared-pdfs/", blank=True)
    sms_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class CoachDocument(models.Model):
    """Coach's résumé and certificates (C32 › پروفایل)."""

    class Kind(models.TextChoices):
        RESUME = "resume"
        CERTIFICATE = "certificate"

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name="documents")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    file = models.FileField(upload_to=document_upload_to, validators=[validate_document])
    name = models.CharField(max_length=200)
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["kind", "-created_at"]
