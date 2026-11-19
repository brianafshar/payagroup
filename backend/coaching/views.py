from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts import services
from accounts.serializers import LinkRequestSerializer, LinkSerializer
from core.models import audit
from core.permissions import AdminAnyPerm, AdminPerm, IsAthlete, IsCoach, admin_can, is_admin, is_coach

from . import analytics, purge, stats
from .models import AccountStatus, Athlete, Coach, CoachDocument, HealthProfile, TestDefinition
from .overview import athlete_overview, athlete_progress
from .serializers import (
    AthleteCreateSerializer,
    AthleteSerializer,
    CoachCreateSerializer,
    CoachDocumentSerializer,
    CoachProfileSerializer,
    CoachSerializer,
    HealthProfileSerializer,
    NoteSerializer,
    TestDefinitionSerializer,
)

BRANDING_FIELDS = {"app_name", "initials", "primary", "secondary", "theme", "logo", "remove_logo"}


class ExtendSerializer(serializers.Serializer):
    days = serializers.IntegerField(min_value=1, max_value=1095, default=30)


class StatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[AccountStatus.ACTIVE, AccountStatus.INACTIVE, AccountStatus.PAUSED])


def filter_effective_status(qs, value: str | None):
    """`?status=` on the *effective* status (an expired active coach counts as inactive)."""
    if not value:
        return qs
    now = timezone.now()
    expired = Q(status=AccountStatus.ACTIVE, expires_at__lte=now)
    if value == AccountStatus.ACTIVE:
        return qs.filter(status=AccountStatus.ACTIVE).exclude(expires_at__lte=now)
    if value == AccountStatus.INACTIVE:
        return qs.filter(Q(status=AccountStatus.INACTIVE) | expired)
    if value == "expiring":
        return qs.filter(status=AccountStatus.ACTIVE, expires_at__gt=now, expires_at__lte=now + timedelta(days=7))
    return qs.filter(status=value)


@extend_schema(parameters=[OpenApiParameter("status", str, description="active · inactive (incl. expired) · invited · draft · paused · expiring (≤ 7 days)")])
class CoachViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Coach workspaces (A03–A05, A07). Any admin with `cm` or `br` reads; `cm` creates, extends and changes
    status; branding fields need `br`."""

    serializer_class = CoachSerializer
    queryset = Coach.objects.select_related("user").prefetch_related("tests")
    search_fields = ["user__name", "user__email", "app_name"]
    ordering_fields = ["created_at", "expires_at", "user__name", "user__last_login"]
    filterset_fields = ["sport"]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_permissions(self):
        # Any admin with `cm` or `br` gets in; each action then checks the key it needs.
        return [AdminPerm("cm", read_key="br")()] if self.request.method != "PATCH" else [AdminAnyPerm("cm", "br")()]

    def get_queryset(self):
        return filter_effective_status(super().get_queryset(), self.request.query_params.get("status"))

    def destroy(self, request, pk=None):
        """Delete a coach for good (#102): their athletes with all their data, programs, library, foods,
        groups, files and account. Admins with `cm`."""
        coach = self.get_object()
        name, cid = coach.user.name, coach.pk
        n = purge.delete_coach(coach)
        audit(request.user, "coach.delete", None, coach=cid, name=name, athletes=n)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_class(self):
        return CoachCreateSerializer if self.action == "create" else CoachSerializer

    @extend_schema(request=CoachCreateSerializer, responses=CoachSerializer)
    def create(self, request):
        s = CoachCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            coach = s.save()
            audit(request.user, "coach.create", coach)
            if s.validated_data["send_invite"]:
                services.issue_invite(kind="coach", email=coach.user.email, name=coach.user.name, by=request.user, send=True, user=coach.user, coach=coach)
        return Response(CoachSerializer(coach, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        fields = set(serializer.validated_data) | {f"user.{k}" for k in serializer.validated_data.get("user", {})}
        if fields & BRANDING_FIELDS and not admin_can(self.request.user, "br"):
            raise PermissionDenied("Branding needs the branding permission.")
        if fields - BRANDING_FIELDS and not admin_can(self.request.user, "cm"):
            raise PermissionDenied("Needs the coach-management permission.")
        serializer.save()
        audit(self.request.user, "coach.update", serializer.instance, fields=",".join(sorted(fields)))

    @extend_schema(request=ExtendSerializer, responses=CoachSerializer)
    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        """Extend validity by N days (default 30) from the later of today and the end date; reactivates."""
        coach = self.get_object()
        s = ExtendSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if coach.validity_days is None:
            raise ValidationError({"days": "This account is unlimited."})
        coach.extend(s.validated_data["days"])
        coach.save()
        audit(request.user, "coach.extend", coach, days=s.validated_data["days"], expires_at=coach.expires_at.isoformat())
        return Response(CoachSerializer(coach, context={"request": request}).data)

    @extend_schema(request=StatusSerializer, responses=CoachSerializer)
    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        """Activate / deactivate / pause. Deactivating ends the coach's sessions; data is retained."""
        coach = self.get_object()
        s = StatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        new = s.validated_data["status"]
        if new == AccountStatus.ACTIVE:
            if coach.user.pending:
                raise ValidationError({"status": "The coach hasn't accepted the invite yet."})
            coach.activate()
        else:
            coach.status = new
            coach.user.end_sessions()
        coach.save()
        audit(request.user, "coach.activate" if new == AccountStatus.ACTIVE else "coach.deactivate", coach, status=new)
        return Response(CoachSerializer(coach, context={"request": request}).data)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        """A05 counts: athletes, programs and logged sessions (no athlete-level data)."""
        from training.models import Program, WorkoutLog

        coach = self.get_object()
        today = timezone.localdate()
        done = WorkoutLog.objects.filter(athlete__coach=coach, status__in=["completed", "partial"])
        return Response(
            {
                "athletes": coach.athletes.count(),
                "active_athletes": coach.athletes.filter(status=AccountStatus.ACTIVE).count(),
                "templates": Program.objects.filter(coach=coach, kind="template", archived=False).count(),
                "assigned": coach.athletes.exclude(program=None).count(),
                "workouts_week": done.filter(date__gt=today - timedelta(days=7)).count(),
                "workouts_prev_week": done.filter(date__gt=today - timedelta(days=14), date__lte=today - timedelta(days=7)).count(),
                "two_factor": coach.user.two_factor,
            }
        )

    @extend_schema(request=LinkRequestSerializer, responses=LinkSerializer)
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        """New 7-day invite link: emailed (`send: true`) or returned for copying (audit-logged)."""
        coach = self.get_object()
        if not coach.user.pending:
            raise ValidationError({"detail": "The coach already has an account. Use a reset link instead."})
        s = LinkRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        link = services.issue_invite(
            kind="coach",
            email=coach.user.email,
            name=coach.user.name,
            by=request.user,
            send=s.validated_data["send"],
            to=s.validated_data.get("email"),
            user=coach.user,
            coach=coach,
        )
        if coach.status == AccountStatus.DRAFT:
            coach.status = AccountStatus.INVITED
            coach.save(update_fields=["status"])
        return Response(LinkSerializer(link).data)


class RenewalRequestView(APIView):
    """C10 «درخواست تمدید»: emails the super admins and shows up in their notifications (once a day)."""

    permission_classes = [IsCoach]

    @extend_schema(request=None, responses={202: None})
    def post(self, request):
        from accounts import emails
        from accounts.models import User
        from core.models import AuditEvent

        coach = request.user.coach
        since = timezone.now() - timedelta(days=1)
        if not AuditEvent.objects.filter(action="coach.renewal_request", target_type="coach", target_id=str(coach.pk), at__gte=since).exists():
            audit(request.user, "coach.renewal_request", coach, days_left=coach.days_left)
            for admin in User.objects.filter(role="admin", admin_role="super", is_active=True):
                try:
                    emails.send_renewal_request(admin.email, request.user.name, coach.app_name, coach.days_left)
                except emails.EmailNotSent:
                    pass  # logged; the request still shows up in the admins' notifications
        return Response(status=status.HTTP_202_ACCEPTED)


class CoachProfileView(APIView):
    """The signed-in coach's settings (C32): name, sport, bio, measurement cadence."""

    permission_classes = [IsCoach]

    @extend_schema(responses=CoachProfileSerializer)
    def get(self, request):
        return Response(CoachProfileSerializer(request.user.coach, context={"request": request}).data)

    @extend_schema(request=CoachProfileSerializer, responses=CoachProfileSerializer)
    def patch(self, request):
        s = CoachProfileSerializer(request.user.coach, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class TestDefinitionViewSet(viewsets.ModelViewSet):
    """Coach-defined performance tests (C32)."""

    serializer_class = TestDefinitionSerializer
    permission_classes = [IsCoach]
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TestDefinition.objects.none()
        return TestDefinition.objects.filter(coach__in=self.request.user.coach.gym_ids())

    def perform_create(self, serializer):
        if TestDefinition.objects.filter(coach=self.request.user.coach, name=serializer.validated_data["name"]).exists():
            raise ValidationError({"name": "A test with this name exists."}, code="conflict")
        serializer.save(coach=self.request.user.coach)


class CoachDocumentViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """The coach's résumé (one; a new upload replaces it) and certificates."""

    serializer_class = CoachDocumentSerializer
    permission_classes = [IsCoach]
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CoachDocument.objects.none()
        return CoachDocument.objects.filter(coach=self.request.user.coach)

    def perform_create(self, serializer):
        coach = self.request.user.coach
        f = serializer.validated_data["file"]
        if serializer.validated_data["kind"] == CoachDocument.Kind.RESUME:
            for old in coach.documents.filter(kind=CoachDocument.Kind.RESUME):
                old.file.delete(save=False)
                old.delete()
        serializer.save(coach=coach, name=f.name[:200], size=f.size)

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()


class BulkStatusSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=500)
    status = serializers.ChoiceField(choices=[AccountStatus.ACTIVE, AccountStatus.INACTIVE, AccountStatus.PAUSED])


class TransferSerializer(serializers.Serializer):
    coach_id = serializers.IntegerField()


class AthletePermission(AdminPerm("ath")):
    """Admins with `ath` (account management only) or coaches (their own athletes)."""

    def has_permission(self, request, view):
        return is_coach(request.user) or super().has_permission(request, view)


@extend_schema(parameters=[OpenApiParameter("coach", int), OpenApiParameter("status", str), OpenApiParameter("goal", str)])
class AthleteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Athletes. Coaches: their own (C11–C13). Admins with `ath`: everyone, accounts only (A06) — never health,
    training or nutrition data."""

    serializer_class = AthleteSerializer
    permission_classes = [AthletePermission]
    search_fields = ["name", "email", "phone"]
    ordering_fields = ["name", "created_at", "last_active_at"]
    filterset_fields = ["status", "goal", "gender", "coach"]
    http_method_names = ["get", "post", "patch", "put", "delete"]

    def get_queryset(self):
        qs = Athlete.objects.select_related("coach__user", "user", "program")
        user = self.request.user
        if is_coach(user):
            return qs.filter(coach__in=user.coach.athlete_scope_ids())
        return qs if is_admin(user) else qs.none()

    def get_serializer_class(self):
        return AthleteCreateSerializer if self.action == "create" else AthleteSerializer

    def coach_only(self):
        if not is_coach(self.request.user):
            raise PermissionDenied("Coaches only.")

    @extend_schema(request=AthleteCreateSerializer, responses=AthleteCreateSerializer)
    def create(self, request):
        """Coach: a new athlete of theirs. Admin (`ath`, #96): for the coach in `coach`; the invite is in that
        coach's name (their app, their name in the email) and the admin gets the link to copy."""
        if is_coach(request.user):
            coach, inviter = request.user.coach, request.user
        else:
            coach_id = request.data.get("coach")
            if not str(coach_id or "").isdigit():
                raise ValidationError({"coach": "Choose the athlete's coach."})
            coach = get_object_or_404(Coach.objects.select_related("user"), pk=coach_id)
            inviter = coach.user
        s = AthleteCreateSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        invite = s.validated_data.pop("invite")
        invite = None if invite == "none" else invite
        if coach.athlete_cap is not None and coach.athlete_count >= coach.athlete_cap:
            raise ValidationError({"detail": "Athlete limit reached."}, code="cap_reached")
        with transaction.atomic():
            athlete = Athlete.objects.create(coach=coach, status=AccountStatus.INVITED if invite else AccountStatus.DRAFT, **s.validated_data)
            link = None
            if invite:
                link = services.issue_invite(
                    kind="athlete", email=athlete.email, name=athlete.name, by=inviter, send=invite == "email", athlete=athlete, coach=coach
                )
        if inviter != request.user:
            audit(request.user, "athlete.create", athlete, coach=coach.pk)
        data = AthleteSerializer(athlete, context={"request": request}).data
        data["invite_link"] = link
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        self.coach_only()
        serializer.save()

    def destroy(self, request, pk=None):
        """Delete an athlete for good (#77): their programs, workouts, measurements, nutrition, recovery,
        chat, invites and uploaded files go too, and their app account is signed out and removed. Their
        coach, or an admin with `ath` (#102)."""
        athlete = self.get_object()
        name, aid = athlete.name, athlete.pk
        purge.delete_athlete(athlete)
        audit(request.user, "athlete.delete", None, athlete=aid, name=name)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=BulkStatusSerializer, responses={200: dict})
    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request):
        """Activate / deactivate / pause many athletes. Only athletes with an account can be active."""
        s = BulkStatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        qs = self.get_queryset().filter(pk__in=s.validated_data["ids"])
        new = s.validated_data["status"]
        eligible = qs.exclude(user=None) if new == AccountStatus.ACTIVE else qs
        users = [a.user for a in eligible if a.user and new != AccountStatus.ACTIVE]
        updated = eligible.update(status=new)
        for u in users:
            u.end_sessions()
        audit(request.user, "athlete.status", None, ids=",".join(map(str, s.validated_data["ids"])), status=new)
        return Response({"updated": updated, "skipped": qs.count() - updated})

    @extend_schema(request=TransferSerializer, responses=AthleteSerializer)
    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        """Move an athlete to another coach. Admins only. Their records, workout history, measurements,
        health profile and chat move with them; the old coach's training program does not — the new
        coach assigns one (the old coach's copy is archived)."""
        if not is_admin(request.user):
            raise PermissionDenied()
        athlete = self.get_object()
        s = TransferSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        coach = get_object_or_404(Coach, pk=s.validated_data["coach_id"])
        old = athlete.coach_id
        if coach.pk != old:
            from training.models import Program

            Program.objects.filter(athlete=athlete, coach_id=old).update(archived=True)
            athlete.program = None
            athlete.program_start = None
        athlete.coach = coach
        athlete.save(update_fields=["coach", "program", "program_start"])
        audit(request.user, "athlete.transfer", athlete, from_coach=old, to_coach=coach.pk)
        return Response(AthleteSerializer(athlete, context={"request": request}).data)

    @extend_schema(request=LinkRequestSerializer, responses=LinkSerializer)
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        """New 7-day invite link: emailed or returned for copying (audit-logged)."""
        athlete = self.get_object()
        if athlete.user_id:
            raise ValidationError({"detail": "The athlete already has an account."})
        s = LinkRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        link = services.issue_invite(
            kind="athlete",
            email=athlete.email,
            name=athlete.name,
            by=request.user if is_coach(request.user) else athlete.coach.user,  # always in the coach's name (#96)
            send=s.validated_data["send"],
            to=s.validated_data.get("email"),
            athlete=athlete,
            coach=athlete.coach,
        )
        if athlete.status == AccountStatus.DRAFT:
            athlete.status = AccountStatus.INVITED
            athlete.save(update_fields=["status"])
        return Response(LinkSerializer(link).data)

    @extend_schema(parameters=[OpenApiParameter("from", str), OpenApiParameter("to", str)], responses={200: dict})
    @action(detail=True, methods=["get"])
    def calendar(self, request, pk=None):
        """C23: one row per day in [from, to] — the training status over every program (rest when nothing
        is prescribed; planned ahead, missed behind), and whether the day's nutrition, recovery check-in and
        scheduled measurement were logged, with `missing` listing what wasn't (#89)."""
        from datetime import date as _date

        from training.days import day_checks
        from training.models import WorkoutLog
        from training.services import sessions_for
        from training.services import trains as _trains

        self.coach_only()
        athlete = self.get_object()
        try:
            start = _date.fromisoformat(request.query_params.get("from", ""))
            end = _date.fromisoformat(request.query_params.get("to", ""))
        except ValueError:
            raise ValidationError({"from": "Use YYYY-MM-DD for from and to."}) from None
        if (end - start).days > 62 or end < start:
            raise ValidationError({"to": "Up to 62 days."})
        # The main program's session first; other programs' sessions (#74) count for the day too.
        logs: dict = {}
        for w in WorkoutLog.objects.filter(athlete=athlete, date__gte=start, date__lte=end).order_by("id"):
            if w.date not in logs or w.program_id == athlete.program_id:
                logs[w.date] = w
        dates = [start + timedelta(days=i) for i in range((end - start).days + 1)]
        checks = day_checks(athlete, dates)
        rows = []
        for d in dates:
            ss = sessions_for(athlete, d)
            s = next((x for x in ss if _trains(x)), ss[0])
            day = s["day"] or {}
            log = logs.get(d)
            c = checks[d]
            rows.append(
                {
                    "date": d,
                    # #89: a day with nothing prescribed is rest (done), not missed.
                    "status": c["training"],
                    "focus": (
                        log.focus
                        if log and log.focus
                        else " + ".join(x["day"]["focus"] for x in ss if _trains(x) and x["day"].get("focus")) or day.get("focus", "")
                    ),
                    "week": s["week"],
                    "workout_id": log.pk if log and (c["training"] != "rest" or log.status in ("completed", "partial", "in-progress")) else None,
                    "nutrition": c["nutrition"],
                    "recovery": c["recovery"],
                    "measure": c["measure"],
                    "missing": c["missing"],
                }
            )
        return Response(rows)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"])
    def overview(self, request, pk=None):
        """C12 overview (coach only)."""
        self.coach_only()
        return Response(athlete_overview(self.get_object()))

    @extend_schema(
        parameters=[OpenApiParameter("section", str, enum=list(analytics.SECTIONS)), OpenApiParameter("days", int)],
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        """C26–C30 analytics for one athlete (coach only). `days` applies to overview (7–365) and recovery (7–60)."""
        self.coach_only()
        section = request.query_params.get("section", "overview")
        if section not in analytics.SECTIONS:
            raise ValidationError({"section": "Unknown section."})
        a = self.get_object()
        try:
            days = int(request.query_params.get("days", 0))
        except ValueError:
            days = 0
        if section == "overview":
            return Response(analytics.overview(a, min(365, max(7, days or 180))))
        if section == "recovery":
            return Response(analytics.recovery(a, min(60, max(7, days or 14))))
        if section == "trends":
            return Response(analytics.trends(a, days or 180))
        return Response(analytics.SECTIONS[section](a))

    @extend_schema(methods=["GET"], responses=NoteSerializer(many=True))
    @extend_schema(methods=["POST"], request=NoteSerializer, responses=NoteSerializer)
    @action(detail=True, methods=["get", "post"])
    def notes(self, request, pk=None):
        """The coach's private notes about the athlete."""
        self.coach_only()
        athlete = self.get_object()
        if request.method == "GET":
            return Response(NoteSerializer(athlete.notes.all(), many=True).data)
        s = NoteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(athlete=athlete, author=request.user)
        return Response(s.data, status=status.HTTP_201_CREATED)

    @extend_schema(methods=["GET"], responses=HealthProfileSerializer)
    @extend_schema(methods=["PUT"], request=HealthProfileSerializer, responses=HealthProfileSerializer)
    @action(detail=True, methods=["get", "put"])
    def health(self, request, pk=None):
        """Athlete health profile — the coach only; every read and edit is audit-logged."""
        self.coach_only()
        athlete = self.get_object()
        profile, _ = HealthProfile.objects.get_or_create(athlete=athlete)
        if request.method == "GET":
            audit(request.user, "health.view", athlete)
            return Response(HealthProfileSerializer(profile).data)
        s = HealthProfileSerializer(profile, data=request.data)
        s.is_valid(raise_exception=True)
        s.save(updated_by=request.user)
        audit(request.user, "health.edit", athlete)
        return Response(s.data)


class MyAthleteSerializer(AthleteSerializer):
    class Meta(AthleteSerializer.Meta):
        read_only_fields = [*AthleteSerializer.Meta.read_only_fields, "email", "goal_weight_kg", "measure_schedule"]


class MyAthleteView(APIView):
    """The signed-in athlete's profile (M45, invite basics step in M48)."""

    permission_classes = [IsAthlete]

    @extend_schema(responses=MyAthleteSerializer)
    def get(self, request):
        return Response(MyAthleteSerializer(request.user.athlete, context={"request": request}).data)

    @extend_schema(request=MyAthleteSerializer, responses=MyAthleteSerializer)
    def patch(self, request):
        s = MyAthleteSerializer(request.user.athlete, data=request.data, partial=True, context={"request": request})
        s.is_valid(raise_exception=True)
        athlete = s.save()
        user_fields = {k: getattr(athlete, k) for k in ("name", "phone") if k in s.validated_data}
        if user_fields:
            for k, v in user_fields.items():
                setattr(request.user, k, v)
            request.user.save(update_fields=list(user_fields))
        return Response(s.data)


class MyProgressView(APIView):
    """M43 progress for the signed-in athlete (`?days=30…1095`, or `3650` for everything), with `trends`."""

    permission_classes = [IsAthlete]

    @extend_schema(parameters=[OpenApiParameter("days", int)], responses={200: dict})
    def get(self, request):
        days = request.query_params.get("days", "180")
        days = int(days) if days.isdigit() and 7 <= int(days) <= analytics.MAX_DAYS else 180
        a = request.user.athlete
        return Response({**athlete_progress(a, days), "trends": analytics.trends(a, days)})


class MyHealthView(APIView):
    """The athlete's own health profile (M46)."""

    permission_classes = [IsAthlete]

    @extend_schema(responses=HealthProfileSerializer)
    def get(self, request):
        profile, _ = HealthProfile.objects.get_or_create(athlete=request.user.athlete)
        return Response(HealthProfileSerializer(profile).data)

    @extend_schema(request=HealthProfileSerializer, responses=HealthProfileSerializer)
    def put(self, request):
        profile, _ = HealthProfile.objects.get_or_create(athlete=request.user.athlete)
        s = HealthProfileSerializer(profile, data=request.data)
        s.is_valid(raise_exception=True)
        s.save(updated_by=request.user)
        return Response(s.data)


class CoachDashboardView(APIView):
    """C10: roster summary, athletes needing attention (with the reason), today's sessions, pending
    invites, programs ending soon and the account-expiry warning."""

    permission_classes = [IsCoach]

    @extend_schema(responses={200: dict})
    def get(self, request):
        from accounts.models import Invite
        from training.models import WorkoutLog

        coach = request.user.coach
        today = timezone.localdate()
        scope = coach.athlete_scope_ids()
        athletes = list(Athlete.objects.filter(coach__in=scope, status=AccountStatus.ACTIVE).select_related("program"))
        attention, adherence = [], []
        for a in athletes:
            flag, value = stats.attention(a, today)
            if flag:
                attention.append({"athlete_id": a.pk, "name": a.name, "flag": flag, "flag_value": value, **self.detail(a, flag, today)})
            pct = stats.adherence_pct(a, today=today)
            if pct is not None:
                adherence.append(pct)
        order = {"missed": 0, "down": 1, "soreness": 2, "nutrition": 3, "pr": 4}
        attention.sort(key=lambda x: order.get(x["flag"], 9))
        todays = WorkoutLog.objects.filter(athlete__coach__in=scope, date=today)
        done = WorkoutLog.objects.filter(athlete__coach__in=scope, status__in=["completed", "partial"])
        scheduled = sum(1 for a in athletes if stats.expected_sessions(a, today, today))
        counts = {s: todays.filter(status=s).count() for s in ["completed", "partial", "missed", "in-progress"]}
        invited = Athlete.objects.filter(coach__in=scope, status=AccountStatus.INVITED)
        last_invite = {i.athlete_id: i.created_at for i in Invite.objects.filter(athlete__in=invited).order_by("created_at")}
        ending = [
            {"athlete_id": a.pk, "name": a.name, "program": a.program.name, "ends": a.program_start + timedelta(weeks=a.program.duration_weeks)}
            for a in athletes
            if a.program and a.program_start and today <= a.program_start + timedelta(weeks=a.program.duration_weeks) <= today + timedelta(days=7)
        ]
        return Response(
            {
                "athletes": {
                    "active": len(athletes),
                    "total": coach.athlete_count,
                    "cap": coach.athlete_cap,
                    "invited": invited.count(),
                    "trained_7d": done.filter(date__gt=today - timedelta(days=7)).values("athlete").distinct().count(),
                },
                "adherence_pct": round(sum(adherence) / len(adherence)) if adherence else None,
                "today": {
                    "scheduled": scheduled,
                    "completed": counts["completed"],
                    "partial": counts["partial"],
                    "missed": counts["missed"],
                    "in_progress": counts["in-progress"],
                    "not_started": max(0, scheduled - sum(counts.values())),
                },
                "attention": attention,
                "invites": [{"athlete_id": a.pk, "name": a.name, "email": a.email, "invited_at": last_invite.get(a.pk)} for a in invited[:5]],
                "ending": ending[:5],
                "account": {
                    "status": coach.effective_status,
                    "expires_at": coach.expires_at,
                    "days_left": coach.days_left,
                    "warn": coach.days_left is not None and coach.days_left <= coach.reminder_days,
                },
            }
        )

    @staticmethod
    def detail(a, flag: str, today) -> dict:
        """What the flag is about, for the attention list (computed from logged data only)."""
        if flag == "pr":
            r = a.records.select_related("exercise").first()
            return {"exercise": r.exercise.name, "value": r.value, "previous": r.previous, "type": r.type, "at": r.date} if r else {}
        if flag == "missed":
            last = a.workouts.filter(status="missed").order_by("-date").first()
            return {"at": last.date if last else today}
        if flag == "soreness":
            c = a.recovery.exclude(soreness=None).first()
            return {"at": c.date} if c else {}
        return {"at": today}


class AdminStatsView(APIView):
    """A02 platform KPIs (admins with `rep`). Counts only — no athlete training data is exposed."""

    permission_classes = [AdminPerm("rep")]

    @extend_schema(responses={200: dict})
    def get(self, request):
        from training.models import WorkoutLog

        coaches = Coach.objects.all()
        now = timezone.now()
        today = timezone.localdate()
        expiring = filter_effective_status(coaches, "expiring").select_related("user").order_by("expires_at")
        done = WorkoutLog.objects.filter(status__in=["completed", "partial"])
        by_day = dict(done.filter(date__gt=today - timedelta(days=7)).values_list("date").annotate(n=Count("id")))
        week = [by_day.get(today - timedelta(days=6 - i), 0) for i in range(7)]
        prev_week = done.filter(date__gt=today - timedelta(days=14), date__lte=today - timedelta(days=7)).count()
        active = filter_effective_status(coaches, "active")
        setup = filter_effective_status(coaches, "inactive") | coaches.filter(status__in=["draft", "invited"])
        return Response(
            {
                "coaches": {s: filter_effective_status(coaches, s).count() for s in ["active", "inactive", "invited", "draft", "paused"]},
                "athletes": {
                    "total": Athlete.objects.count(),
                    "active": Athlete.objects.filter(status=AccountStatus.ACTIVE).count(),
                    "new_month": Athlete.objects.filter(created_at__gte=now - timedelta(days=30)).count(),
                },
                "new_coaches_30d": coaches.filter(created_at__gte=now - timedelta(days=30)).count(),
                "workouts_7d": sum(week),
                "workouts_prev_7d": prev_week,
                "workouts_by_day": week,
                "coach_logins_7d": active.filter(user__last_login__gte=now - timedelta(days=7)).count(),
                "setup": [
                    {
                        "id": c.pk,
                        "name": c.user.name,
                        "app_name": c.app_name,
                        "status": c.effective_status,
                        "created_at": c.created_at,
                        "expires_at": c.expires_at,
                        "athletes": c.athlete_count,
                        "last_login_at": c.user.last_login,
                    }
                    for c in setup.select_related("user").distinct().order_by("-created_at")[:8]
                ],
                "expiring": [
                    {"id": c.pk, "name": c.user.name, "app_name": c.app_name, "expires_at": c.expires_at, "days_left": c.days_left} for c in expiring[:20]
                ],
                # Coaches per sport module (A02 › ماژول‌های ورزشی).
                "sports": dict(active.values_list("sport").annotate(n=Count("id"))),
                "platform": {"version": settings.PLATFORM_VERSION, "region": settings.PLATFORM_REGION, "support_email": settings.SUPPORT_EMAIL},
            }
        )


class TeamSerializer(serializers.Serializer):
    """Head coach creates a coach under them: a password is set directly (no invite e-mail needed)."""

    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    password = serializers.CharField(min_length=8, write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        from accounts.models import User

        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("Email already in use.", code="conflict")
        return value.lower()


class HeadCoachOnly(IsCoach):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.coach.is_head


class TeamViewSet(viewsets.GenericViewSet):
    """Head coach (سرمربی): the coaches under them — create, list, activate / deactivate."""

    permission_classes = [HeadCoachOnly]
    serializer_class = TeamSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Coach.objects.none()
        return self.request.user.coach.team.select_related("user")

    def _row(self, c: Coach) -> dict:
        return {
            "id": c.pk,
            "name": c.user.name,
            "email": c.user.email,
            "phone": c.user.phone,
            "status": c.status,
            "athlete_count": c.athlete_count,
            "last_login_at": c.user.last_login,
        }

    @extend_schema(responses={200: dict})
    def list(self, request):
        return Response([self._row(c) for c in self.get_queryset()])

    @extend_schema(request=TeamSerializer, responses={201: dict})
    def create(self, request):
        from accounts.models import User
        s = TeamSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        head = request.user.coach
        with transaction.atomic():
            user = User.objects.create_user(d["email"], password=d["password"], name=d["name"], role=User.Role.COACH, phone=d["phone"])
            coach = Coach.objects.create(
                user=user, head=head, app_name=head.app_name, sport=head.sport, primary=head.primary, secondary=head.secondary,
                status=AccountStatus.ACTIVE, activated_at=timezone.now(),
            )  # fmt: skip
            # no library.install: the library and templates are shared with the head coach
            audit(request.user, "coach.team_create", coach)
        return Response(self._row(coach), status=status.HTTP_201_CREATED)

    @extend_schema(request=StatusSerializer, responses={200: dict})
    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        coach = get_object_or_404(self.get_queryset(), pk=pk)
        s = StatusSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        new = s.validated_data["status"]
        if new == AccountStatus.ACTIVE:
            coach.status = AccountStatus.ACTIVE
        else:
            coach.status = new
            coach.user.end_sessions()
        coach.save()
        audit(request.user, "coach.team_status", coach, status=new)
        return Response(self._row(coach))
