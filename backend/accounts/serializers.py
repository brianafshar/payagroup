import time

from django.contrib.auth import authenticate, password_validation
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import EPOCH_CLAIM, tokens_for
from .models import User


class BrandingSerializer(serializers.Serializer):
    """White-label branding the athlete app and coach panel theme themselves with."""

    app_name = serializers.CharField()
    initials = serializers.CharField()
    logo_url = serializers.SerializerMethodField()
    primary = serializers.CharField()
    secondary = serializers.CharField()
    theme = serializers.CharField()

    def get_logo_url(self, coach) -> str | None:
        if not coach.logo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(coach.logo.url) if request else coach.logo.url


class MeSerializer(serializers.ModelSerializer):
    """The signed-in user. `coachId` / `athleteId` and `branding` depend on the role."""

    admin_role = serializers.CharField(read_only=True)
    coach_id = serializers.SerializerMethodField()
    athlete_id = serializers.SerializerMethodField()
    branding = serializers.SerializerMethodField()
    pending = serializers.BooleanField(read_only=True)
    mfa_setup_required = serializers.BooleanField(read_only=True)
    remove_photo = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "mfa_setup_required",
            "remove_photo",
            "id",
            "email",
            "name",
            "role",
            "admin_role",
            "phone",
            "photo",
            "theme",
            "two_factor",
            "force_password_change",
            "pending",
            "coach_id",
            "athlete_id",
            "branding",
            "last_login",
        ]
        read_only_fields = ["id", "email", "role", "two_factor", "force_password_change", "last_login"]

    def validate_phone(self, value):
        digits = value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")).replace(" ", "")
        if digits and not (len(digits) == 11 and digits.startswith("09") and digits.isdigit()):
            raise serializers.ValidationError("Use the 09xxxxxxxxx format.")
        return digits

    def update(self, user, validated):
        if validated.pop("remove_photo", False) and user.photo:
            user.photo.delete(save=False)
            user.photo = ""
        return super().update(user, validated)

    def get_coach_id(self, user) -> int | None:
        return user.coach.pk if user.role == "coach" and hasattr(user, "coach") else None

    def get_athlete_id(self, user) -> int | None:
        return user.athlete.pk if user.role == "athlete" and hasattr(user, "athlete") else None

    def get_branding(self, user) -> dict | None:
        coach = getattr(user, "coach", None) if user.role == "coach" else getattr(getattr(user, "athlete", None), "coach", None)
        return BrandingSerializer(coach, context=self.context).data if coach else None


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    # Which panel/app the user is signing in to; a mismatch is refused (e.g. an athlete on /coach/login).
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)

    def validate(self, attrs):
        user = authenticate(self.context.get("request"), email=attrs["email"].lower(), password=attrs["password"])
        if user is None:
            raise AuthenticationFailed("Email or password is incorrect.", code="invalid_credentials")
        if attrs.get("role") and attrs["role"] != user.role:
            raise PermissionDenied("This account can't sign in here.", code="wrong_role")
        reason = user.sign_in_block_reason()
        if reason:
            raise PermissionDenied("Account is not active.", code=reason)
        attrs["user"] = user
        return attrs


class EpochTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh fails once the user's sessions were ended or the account may no longer sign in."""

    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user = User.objects.filter(pk=refresh.get("user_id")).first()
        from .authentication import SESSION_CLAIM
        from .sessions import is_live

        if user is None or refresh.get(EPOCH_CLAIM) != user.session_epoch or not is_live(refresh.get(SESSION_CLAIM)):
            raise AuthenticationFailed("Session ended. Sign in again.", code="session_ended")
        if user.sign_in_block_reason():
            raise AuthenticationFailed("Account is not active.", code=user.sign_in_block_reason())
        if user.role == User.Role.ADMIN:
            from core.models import PlatformSettings

            limit = PlatformSettings.load().session_timeout_minutes * 60
            if time.time() - refresh.get("auth_time", 0) > limit:
                raise AuthenticationFailed("Admin session timed out. Sign in again.", code="session_timeout")
        return super().validate(attrs)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = MeSerializer()


def token_response(user, context) -> dict:
    """Signs the user in: token pair + the user (and records the login time)."""
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return {**tokens_for(user, context.get("request")), "user": MeSerializer(user, context=context).data}


class NewPasswordField(serializers.CharField):
    def __init__(self, **kwargs):
        super().__init__(write_only=True, trim_whitespace=False, min_length=8, max_length=128, **kwargs)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = NewPasswordField()

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = NewPasswordField()


class AcceptInviteSerializer(serializers.Serializer):
    password = NewPasswordField()


class InviteInfoSerializer(serializers.Serializer):
    kind = serializers.CharField()
    email = serializers.EmailField()
    name = serializers.CharField()
    expired = serializers.BooleanField()
    used = serializers.BooleanField()
    expires_at = serializers.DateTimeField()
    coach_name = serializers.CharField(allow_null=True)
    branding = serializers.DictField(allow_null=True)


class AdminSetPasswordSerializer(serializers.Serializer):
    password = NewPasswordField()
    force_change = serializers.BooleanField(default=True)
    email_user = serializers.BooleanField(default=False)


class LinkRequestSerializer(serializers.Serializer):
    """`send: true` emails the link (to `email` when given, else the account's email); `false` returns it
    for copying (audit-logged)."""

    send = serializers.BooleanField(default=False)
    email = serializers.EmailField(required=False)


class LinkSerializer(serializers.Serializer):
    url = serializers.CharField(allow_null=True)
    expires_at = serializers.DateTimeField()
    sent = serializers.BooleanField()


class AdminUserSerializer(serializers.ModelSerializer):
    """Admin user row (A08). `role` is the admin role (super / support)."""

    role = serializers.ChoiceField(source="admin_role", choices=User.AdminRole.choices)
    pending = serializers.BooleanField(read_only=True)
    invited_at = serializers.DateTimeField(source="date_joined", read_only=True)
    last_login_at = serializers.DateTimeField(source="last_login", read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "two_factor", "pending", "invited_at", "last_login_at"]
        read_only_fields = ["id", "two_factor"]

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Email already in use.", code="conflict")
        return value
