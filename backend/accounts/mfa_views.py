"""Two-factor endpoints: status, setup → enable (returns recovery codes once), disable, new recovery
codes, the login second step, and an admin reset for locked-out users."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import audit
from core.permissions import IsAdmin, admin_can

from . import mfa
from .models import User
from .serializers import TokenPairSerializer, token_response
from .views import PERMISSION_FOR_ROLE, AuthThrottled


class CodeSerializer(serializers.Serializer):
    """`otp`: a 6-digit code from the authenticator app (or a recovery code where accepted)."""

    otp = serializers.CharField(max_length=20)


class VerifySerializer(CodeSerializer):
    mfa_token = serializers.CharField()


class DisableSerializer(CodeSerializer):
    password = serializers.CharField(trim_whitespace=False)


class StatusSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    required = serializers.BooleanField()
    recovery_codes_left = serializers.IntegerField()


class SetupSerializer(serializers.Serializer):
    secret = serializers.CharField()
    otpauth_url = serializers.CharField()


class RecoveryCodesSerializer(serializers.Serializer):
    recovery_codes = serializers.ListField(child=serializers.CharField())


def invalid_code():
    return ValidationError({"otp": "The code is not valid."}, code="invalid_code")


class MfaView(APIView):
    """Two-factor is for the web panels (admins and coaches)."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user.role not in (User.Role.ADMIN, User.Role.COACH):
            raise PermissionDenied("Two-factor login is available for admins and coaches.")


class MfaStatusView(MfaView):
    @extend_schema(responses=StatusSerializer)
    def get(self, request):
        u = request.user
        required = u.mfa_required
        return Response({"enabled": u.two_factor, "required": required, "recovery_codes_left": len(u.recovery_codes or [])})


class MfaSetupView(MfaView):
    """Start (or restart) setup: a new secret to scan as a QR code. Nothing changes until `enable`."""

    @extend_schema(request=None, responses=SetupSerializer)
    def post(self, request):
        u = request.user
        if u.two_factor:
            raise ValidationError({"detail": "Two-factor login is already on."}, code="already_enabled")
        u.totp_pending_secret = mfa.new_secret()
        u.save(update_fields=["totp_pending_secret"])
        return Response({"secret": u.totp_pending_secret, "otpauth_url": mfa.provisioning_uri(u, u.totp_pending_secret)})


class MfaEnableView(AuthThrottled, MfaView):
    """Confirm setup with a code from the app. Returns 10 recovery codes — shown only this once."""

    @extend_schema(request=CodeSerializer, responses=RecoveryCodesSerializer)
    def post(self, request):
        s = CodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        u = request.user
        if not u.totp_pending_secret:
            raise ValidationError({"detail": "Start the setup first."}, code="setup_required")
        u.totp_last_step = None
        if not mfa.verify_totp(u, u.totp_pending_secret, s.validated_data["otp"]):
            raise invalid_code()
        plain, hashed = mfa.new_recovery_codes()
        u.totp_secret, u.totp_pending_secret, u.two_factor, u.recovery_codes = u.totp_pending_secret, "", True, hashed
        u.save(update_fields=["totp_secret", "totp_pending_secret", "two_factor", "recovery_codes"])
        audit(u, "mfa.enable", u)
        return Response({"recovery_codes": plain})


class MfaDisableView(AuthThrottled, MfaView):
    @extend_schema(request=DisableSerializer, responses={204: None})
    def post(self, request):
        s = DisableSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        u = request.user
        if not u.two_factor:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if u.mfa_required:
            raise ValidationError({"detail": "Two-factor login is required for your role."}, code="mfa_required_by_policy")
        if not u.check_password(s.validated_data["password"]):
            raise ValidationError({"password": "Password is incorrect."})
        if not mfa.verify_code(u, s.validated_data["otp"]):
            raise invalid_code()
        _clear(u)
        audit(u, "mfa.disable", u)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MfaRecoveryCodesView(AuthThrottled, MfaView):
    """Replace all recovery codes (needs a current code)."""

    @extend_schema(request=CodeSerializer, responses=RecoveryCodesSerializer)
    def post(self, request):
        s = CodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        u = request.user
        if not u.two_factor or not mfa.verify_totp(u, u.totp_secret, s.validated_data["otp"]):
            raise invalid_code()
        plain, hashed = mfa.new_recovery_codes()
        u.recovery_codes = hashed
        u.save(update_fields=["recovery_codes"])
        audit(u, "mfa.recovery-codes", u)
        return Response({"recovery_codes": plain})


class MfaVerifyView(AuthThrottled, APIView):
    """Login step 2: the `mfaToken` from `auth/login/` plus an app or recovery code → token pair."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=VerifySerializer, responses=TokenPairSerializer)
    def post(self, request):
        s = VerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = mfa.user_from_login_token(s.validated_data["mfa_token"])
        if user is None:
            raise ValidationError({"mfa_token": "Sign in again."}, code="mfa_token_expired")
        if not mfa.verify_code(user, s.validated_data["otp"]):
            raise invalid_code()
        return Response(token_response(user, {"request": request}))


class AdminMfaResetView(APIView):
    """Turn off two-factor for a locked-out user (they set it up again on next sign-in). Audit-logged."""

    permission_classes = [IsAdmin]

    @extend_schema(request=None, responses={204: None})
    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user == request.user or not admin_can(request.user, PERMISSION_FOR_ROLE[user.role]):
            raise PermissionDenied()
        _clear(user)
        user.end_sessions()
        audit(request.user, "mfa.reset", user)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _clear(u: User) -> None:
    u.two_factor, u.totp_secret, u.totp_pending_secret, u.recovery_codes, u.totp_last_step = False, "", "", [], None
    u.save(update_fields=["two_factor", "totp_secret", "totp_pending_secret", "recovery_codes", "totp_last_step"])
