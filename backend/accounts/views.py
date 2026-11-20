from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import ADMIN_PERMISSIONS, AuditEvent, PlatformSettings, audit
from core.permissions import AdminPerm, IsAdmin, admin_can

from . import mfa, services
from .models import Invite, User
from .serializers import (
    AcceptInviteSerializer,
    AdminSetPasswordSerializer,
    AdminUserSerializer,
    BrandingSerializer,
    ChangePasswordSerializer,
    ChangeUsernameSerializer,
    ForgotPasswordSerializer,
    InviteInfoSerializer,
    LinkRequestSerializer,
    LinkSerializer,
    LoginSerializer,
    MeSerializer,
    ResetPasswordSerializer,
    TokenPairSerializer,
    token_response,
)


class AuthThrottled:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def get_authenticate_header(self, request):
        # Unauthenticated endpoints still answer bad credentials with 401 (not 403).
        return 'Bearer realm="api"'


class LoginView(AuthThrottled, APIView):
    """Email + password → JWT pair and the user. Pass `role` to refuse accounts of another panel."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=LoginSerializer, responses=TokenPairSerializer)
    def post(self, request):
        """With two-factor on, answers `{mfaRequired: true, mfaToken}` instead; finish at `auth/2fa/verify/`."""
        s = LoginSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = s.validated_data["user"]
        if user.two_factor:
            return Response({"mfa_required": True, "mfa_token": mfa.login_token(user)})
        return Response(token_response(user, {"request": request}))


class LogoutView(APIView):
    """Revokes the given refresh token — holding it is enough, so clients can sign out after the access
    token has expired or been discarded. `all: true` (signed in) ends every session of the user."""

    permission_classes = [AllowAny]

    class Input(serializers.Serializer):
        refresh = serializers.CharField(required=False)
        all = serializers.BooleanField(default=False)

    @extend_schema(request=Input, responses={204: None})
    def post(self, request):
        s = self.Input(data=request.data)
        s.is_valid(raise_exception=True)
        if s.validated_data.get("refresh"):
            try:
                token = RefreshToken(s.validated_data["refresh"])
                token.blacklist()
                from .authentication import SESSION_CLAIM
                from .models import LoginSession
                from .sessions import end

                sess = LoginSession.objects.filter(pk=token.get(SESSION_CLAIM)).first() if token.get(SESSION_CLAIM) else None
                if sess:
                    end(sess, "logout")
            except TokenError:
                pass
        if s.validated_data["all"]:
            if not request.user.is_authenticated:
                raise NotAuthenticated()
            request.user.end_sessions(by="self")
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """The signed-in user: profile (name, phone 09xxxxxxxxx, photo) and theme preference (Light/Dark/System)."""

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=MeSerializer, responses=MeSerializer)
    def patch(self, request):
        s = MeSerializer(request.user, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        if request.user.role == "athlete" and "name" in s.validated_data:
            request.user.athlete.name = request.user.name
            request.user.athlete.save(update_fields=["name"])
        return Response(s.data)


class ChangePasswordView(APIView):
    """Own password change: ends other sessions and returns a fresh token pair for this device."""

    @extend_schema(request=ChangePasswordSerializer, responses=TokenPairSerializer)
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = request.user
        user.set_password(s.validated_data["new_password"])
        user.force_password_change = False
        user.session_epoch += 1
        user.save(update_fields=["password", "force_password_change", "session_epoch"])
        user.login_sessions.filter(ended_at__isnull=True).update(ended_at=timezone.now(), ended_by="password")
        user.notify_sessions_ended()
        audit(user, "password.change", user, self_service=True)
        return Response(token_response(user, {"request": request}))


class ChangeUsernameView(APIView):
    """Own sign-in name change (needs the current password). The session continues: tokens carry the user id."""

    @extend_schema(request=ChangeUsernameSerializer, responses=MeSerializer)
    def post(self, request):
        s = ChangeUsernameSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = request.user
        old = user.username
        user.username = s.validated_data["username"]
        user.save(update_fields=["username"])
        audit(user, "username.change", user, old=old, new=user.username)
        return Response(MeSerializer(user, context={"request": request}).data)


class ForgotPasswordView(AuthThrottled, APIView):
    """Self-service: emails a new random password (letters + digits) that must be changed after signing in.
    Always 204 — never reveals whether the email exists."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=ForgotPasswordSerializer, responses={204: None})
    def post(self, request):
        s = ForgotPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = User.objects.filter(email=s.validated_data["email"].lower(), is_active=True).first()
        if user and user.has_usable_password():
            services.email_temporary_password(user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResetPasswordView(AuthThrottled, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=ResetPasswordSerializer, responses={204: None})
    def post(self, request):
        s = ResetPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.reset_password(s.validated_data["token"], s.validated_data["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class InviteView(AuthThrottled, APIView):
    """GET: what the invite is for (M48 accept / expired states). POST: set a password and sign in."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get_invite(self, token) -> Invite:
        invite = Invite.objects.by_token(token).select_related("user", "athlete__coach__user").first()
        if invite is None:
            raise ValidationError({"token": "Unknown invite link."}, code="invite_unknown")
        return invite

    @extend_schema(responses=InviteInfoSerializer)
    def get(self, request, token):
        invite = self.get_invite(token)
        coach = invite.athlete.coach if invite.athlete_id else getattr(invite.user, "coach", None)
        name = invite.athlete.name if invite.athlete_id else invite.user.name
        data = {
            "kind": invite.kind,
            "email": invite.email,
            "name": name,
            "expired": invite.expired,
            "used": invite.used_at is not None,
            "expires_at": invite.expires_at,
            "coach_name": coach.user.name if coach and invite.kind == "athlete" else None,
            "branding": BrandingSerializer(coach, context={"request": request}).data if coach else None,
        }
        return Response(InviteInfoSerializer(data).data)

    @extend_schema(request=AcceptInviteSerializer, responses=TokenPairSerializer)
    def post(self, request, token):
        s = AcceptInviteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = services.accept_invite(token, s.validated_data["password"])
        return Response(token_response(user, {"request": request}), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------- admin


PERMISSION_FOR_ROLE = {"coach": "cm", "athlete": "ath", "admin": "adm"}


class AdminUserActionsView(APIView):
    """Admin actions on any account: set password (ends sessions) and reset link (email or copy).
    Needs the matrix permission for the target's role: coaches `cm`, athletes `ath`, admins `adm`."""

    permission_classes = [IsAdmin]

    def target(self, request, pk) -> User:
        user = get_object_or_404(User, pk=pk)
        if not admin_can(request.user, PERMISSION_FOR_ROLE[user.role]):
            raise PermissionDenied()
        return user


class AdminSetPasswordView(AdminUserActionsView):
    @extend_schema(request=AdminSetPasswordSerializer, responses={204: None})
    def post(self, request, pk):
        user = self.target(request, pk)
        s = AdminSetPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.set_password(
            user, s.validated_data["password"], by=request.user, force_change=s.validated_data["force_change"], email_user=s.validated_data["email_user"]
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminResetLinkView(AdminUserActionsView):
    @extend_schema(request=LinkRequestSerializer, responses=LinkSerializer)
    def post(self, request, pk):
        user = self.target(request, pk)
        s = LinkRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(LinkSerializer(services.issue_reset(user, by=request.user, send=s.validated_data["send"], to=s.validated_data.get("email"))).data)


class AdminAccountViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Admin users (A08). Any admin can see the list; changing it needs `adm`. Creating one emails an
    invite; the account stays `pending` until accepted."""

    serializer_class = AdminUserSerializer

    def get_permissions(self):
        return [IsAdmin()] if self.action == "list" else [AdminPerm("adm")()]

    queryset = User.objects.filter(role=User.Role.ADMIN)
    search_fields = ["name", "email"]
    ordering_fields = ["name", "last_login", "date_joined"]
    http_method_names = ["get", "post", "patch", "delete"]

    @transaction.atomic
    def perform_create(self, serializer):
        user = User.objects.create_user(
            serializer.validated_data["email"], name=serializer.validated_data["name"], role=User.Role.ADMIN, admin_role=serializer.validated_data["admin_role"]
        )
        services.issue_invite(kind="admin", email=user.email, name=user.name, by=self.request.user, send=True, user=user)
        serializer.instance = user

    @extend_schema(request=LinkRequestSerializer, responses=LinkSerializer)
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        """Re-send (or copy) the invite of an admin who hasn't accepted yet."""
        user = self.get_object()
        if not user.pending:
            raise ValidationError({"detail": "This admin already has an account."})
        s = LinkRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        link = services.issue_invite(
            kind="admin", email=user.email, name=user.name, by=request.user, send=s.validated_data["send"], user=user, to=s.validated_data.get("email")
        )
        return Response(LinkSerializer(link).data)

    def perform_update(self, serializer):
        if serializer.instance == self.request.user and serializer.validated_data.get("admin_role", "super") != "super":
            raise ValidationError({"role": "You can't demote yourself."})
        self._keep_a_super(serializer.instance, serializer.validated_data.get("admin_role"))
        serializer.save()
        audit(self.request.user, "admin.update", serializer.instance, role=serializer.instance.admin_role)

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError({"detail": "You can't remove yourself."})
        self._keep_a_super(instance, None)
        audit(self.request.user, "admin.remove", instance, email=instance.email)
        instance.delete()

    def _keep_a_super(self, user, new_role):
        if user.admin_role == "super" and new_role != "super":
            if not User.objects.filter(role="admin", admin_role="super", is_active=True).exclude(pk=user.pk).exists():
                raise ValidationError({"role": "At least one super admin is required."})


class PlatformSettingsSerializer(serializers.ModelSerializer):
    labels = serializers.SerializerMethodField()

    class Meta:
        model = PlatformSettings
        fields = ["permissions", "labels", "require_admin_2fa", "require_coach_2fa", "session_timeout_minutes", "audit_retention_days", "updated_at"]
        read_only_fields = ["updated_at"]

    def get_labels(self, _) -> dict:
        return ADMIN_PERMISSIONS

    def validate_permissions(self, value):
        if not isinstance(value, dict) or set(value) - set(ADMIN_PERMISSIONS):
            raise serializers.ValidationError(f"Keys must be among {sorted(ADMIN_PERMISSIONS)}.")
        for key, row in value.items():
            if not (isinstance(row, list) and len(row) == 2 and all(isinstance(x, bool) for x in row)):
                raise serializers.ValidationError(f"{key}: expected [superAdmin, supportAdmin] booleans.")
        if value.get("adm", [True])[0] is False:
            raise serializers.ValidationError("Super admins must keep admin-user management.")
        return value


class PlatformSettingsView(APIView):
    """Roles & permissions matrix and security policy (A08). Any admin reads; `adm` edits."""

    def get_permissions(self):
        return [IsAdmin()] if self.request.method == "GET" else [AdminPerm("adm")()]

    @extend_schema(responses=PlatformSettingsSerializer)
    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.load()).data)

    @extend_schema(request=PlatformSettingsSerializer, responses=PlatformSettingsSerializer)
    def patch(self, request):
        s = PlatformSettingsSerializer(PlatformSettings.load(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        audit(request.user, "settings.update", None, fields=",".join(sorted(s.validated_data)))
        return Response(s.data)


class AuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name", default=None)

    class Meta:
        model = AuditEvent
        fields = ["id", "at", "actor", "actor_name", "action", "target_type", "target_id", "meta"]


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditEventSerializer
    permission_classes = [AdminPerm("audit")]
    queryset = AuditEvent.objects.select_related("actor")
    filterset_fields = ["action", "actor", "target_type", "target_id"]
    ordering_fields = ["at"]


class SessionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    device = serializers.CharField()
    client = serializers.CharField()
    ip = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    last_seen_at = serializers.DateTimeField()
    current = serializers.BooleanField()


def _session_rows(user, current_sid=None) -> list[dict]:
    rows = [s for s in user.login_sessions.filter(ended_at__isnull=True) if s.active]
    return [
        {
            "id": s.pk,
            "device": s.device,
            "client": s.client,
            "ip": s.ip,
            "created_at": s.created_at,
            "last_seen_at": s.last_seen_at,
            "current": str(s.pk) == str(current_sid),
        }
        for s in rows
    ]


class MySessionsView(APIView):
    """The devices you're signed in on. End one (lost phone, shared computer) from here; signing in is
    never limited."""

    @extend_schema(responses=SessionSerializer(many=True))
    def get(self, request):
        return Response(_session_rows(request.user, request.auth.get("sid") if request.auth else None))


class MySessionView(APIView):
    @extend_schema(responses={204: None})
    def delete(self, request, sid):
        from .sessions import end

        end(get_object_or_404(request.user.login_sessions, pk=sid), "self")
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyOtherSessionsView(APIView):
    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        """Sign out everywhere except this device."""
        from .sessions import end

        current = request.auth.get("sid") if request.auth else None
        n = 0
        for s in request.user.login_sessions.filter(ended_at__isnull=True).exclude(pk=current):
            end(s, "self")
            n += 1
        return Response({"ended": n})


class AdminUserSessionsView(AdminUserActionsView):
    """A user's signed-in devices (coaches `cm`, athletes `ath`, admins `adm`); end one or all."""

    @extend_schema(responses=SessionSerializer(many=True))
    def get(self, request, pk):
        return Response(_session_rows(self.target(request, pk)))

    @extend_schema(request=None, responses={200: dict})
    def post(self, request, pk):
        """End every session of the user (all devices sign out; they can sign in again)."""
        user = self.target(request, pk)
        user.end_sessions(by="admin")
        audit(request.user, "user.sessions.end_all", user)
        return Response({"ended": "all"})


class AdminUserSessionView(AdminUserActionsView):
    @extend_schema(responses={204: None})
    def delete(self, request, pk, sid):
        from .sessions import end

        user = self.target(request, pk)
        s = get_object_or_404(user.login_sessions, pk=sid)
        end(s, "admin")
        audit(request.user, "user.session.end", user, device=s.device)
        return Response(status=status.HTTP_204_NO_CONTENT)
