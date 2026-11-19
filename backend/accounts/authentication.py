import time

from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

EPOCH_CLAIM = "epoch"


SESSION_CLAIM = "sid"


def tokens_for(user, request=None) -> dict:
    """Access + refresh pair carrying the user's session epoch and role. With the request, the sign-in
    is also recorded as a device session (`sid`) that can be ended on its own."""
    from . import sessions

    refresh = RefreshToken.for_user(user)
    refresh[EPOCH_CLAIM] = user.session_epoch
    if request is not None:
        refresh[SESSION_CLAIM] = str(sessions.start(user, request).pk)
    refresh["role"] = user.role
    refresh["auth_time"] = int(time.time())  # kept through refresh rotation (admin session timeout)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class EpochJWTAuthentication(JWTAuthentication):
    """JWT auth that also rejects tokens issued before the user's sessions were ended, and users who
    may not sign in any more (deactivated, coach account expired, athlete removed)."""

    def authenticate(self, request):
        result = super().authenticate(request)
        # Admins who must use two-factor can only reach the auth endpoints (to set it up) until they do.
        if result and result[0].mfa_setup_required and not request.path.startswith("/api/auth/"):
            raise PermissionDenied("Set up two-factor login first.", code="mfa_setup_required")
        return result

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        from . import sessions

        sid = validated_token.get(SESSION_CLAIM)
        if validated_token.get(EPOCH_CLAIM) != user.session_epoch or not sessions.is_live(sid):
            raise AuthenticationFailed("Session ended. Sign in again.", code="session_ended")
        sessions.touch(sid)
        reason = user.sign_in_block_reason()
        if reason:
            raise AuthenticationFailed("Account is not active.", code=reason)
        return user
