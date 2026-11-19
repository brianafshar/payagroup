"""Top-bar data for the admin and coach panels: global search (`GET /api/search/?q=`) and the
notifications list (`GET /api/notifications/`, `POST /api/notifications/read/`).

Notifications are derived from recent activity rather than stored: coaches see new records, high
soreness check-ins, unread athlete messages and athlete-recorded measurements; admins see invites
that haven't been accepted, coaches near their athlete cap and accounts about to expire. Athletes
see unread coach messages, changes the coach made to their program, nutrition or recovery plan, and
today's check-in reminder — the in-app copy of what push would say, so the app needs no push. Anything
newer than `user.notifications_seen_at` is unread.
"""

from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from coaching.models import AccountStatus, Athlete, Coach
from messaging.models import Message
from tracking.models import Measurement, NutritionPlan, RecoveryCheckIn, RecoveryPlan
from training.models import Exercise, PersonalRecord, Program

from .permissions import admin_can, is_admin, is_athlete, is_coach

WINDOW_DAYS = 14
LIMIT = 20


def _staff(user):
    if not (is_admin(user) or is_coach(user)):
        raise PermissionDenied()


class SearchView(APIView):
    """Coaches: their athletes, templates and exercises. Admins: coaches (and athletes with `ath`)."""

    @extend_schema(parameters=[OpenApiParameter("q", str)], responses={200: dict})
    def get(self, request):
        _staff(request.user)
        q = request.query_params.get("q", "").strip()
        if len(q) < 1:
            return Response({"results": []})
        out = []
        if is_coach(request.user):
            coach = request.user.coach
            for a in Athlete.objects.filter(coach=coach, name__icontains=q).select_related("program")[:6]:
                out.append({"kind": "athlete", "id": a.pk, "title": a.name, "subtitle": a.program.name if a.program_id else ""})
            for p in Program.objects.filter(coach=coach, kind="template", archived=False, name__icontains=q)[:4]:
                out.append({"kind": "program", "id": p.pk, "title": p.name, "subtitle": p.goal, "sessions_per_week": p.sessions_per_week})
            for e in Exercise.objects.filter(coach=coach, name__icontains=q)[:4]:
                out.append({"kind": "exercise", "id": e.pk, "title": e.name, "category": e.category, "equipment": e.equipment})
        else:
            coaches = Coach.objects.filter(Q(user__name__icontains=q) | Q(app_name__icontains=q) | Q(user__email__icontains=q)).select_related("user")
            for c in coaches[:6]:
                out.append({"kind": "coach", "id": c.pk, "title": c.user.name, "subtitle": c.app_name, "status": c.effective_status})
            if admin_can(request.user, "ath"):
                for a in Athlete.objects.filter(name__icontains=q).select_related("coach__user")[:4]:
                    out.append({"kind": "athlete", "id": a.pk, "title": a.name, "subtitle": a.coach.user.name})
        return Response({"results": out})


def _on_day(day, stamp):
    """When a dated entry happened: its save time if saved that day, else the start of its day
    (entries back-filled or imported later shouldn't read as "today")."""
    return stamp if timezone.localdate(stamp) == day else timezone.make_aware(datetime.combine(day, time()))


def coach_notifications(coach, since):
    items = []
    athletes = Athlete.objects.filter(coach=coach)
    records = PersonalRecord.objects.filter(athlete__in=athletes, date__gte=since.date()).select_related("athlete", "exercise", "logged_set__log")
    best = set()
    for r in records.order_by("-date", "-value", "-id")[:LIMIT]:
        if (r.athlete_id, r.exercise_id) in best:  # one per lift: the latest (heaviest) record
            continue
        best.add((r.athlete_id, r.exercise_id))
        log = r.logged_set.log if r.logged_set_id else None
        at = (log and (log.finished_at or log.started_at)) or timezone.make_aware(datetime.combine(r.date, time()))
        items.append(
            {"kind": "pr", "at": at, "athlete_id": r.athlete_id, "athlete_name": r.athlete.name, "exercise": r.exercise.name, "value": r.value, "unit": r.unit}
        )
    sore = {}
    for c in RecoveryCheckIn.objects.filter(athlete__in=athletes, updated_at__gte=since, soreness__gte=8).select_related("athlete").order_by("-date"):
        sore.setdefault(c.athlete_id, c)  # latest check-in per athlete
    for c in sore.values():
        items.append({"kind": "soreness", "at": _on_day(c.date, c.updated_at), "athlete_id": c.athlete_id, "athlete_name": c.athlete.name, "value": c.soreness})
    latest = {}
    for m in (
        Message.objects.filter(athlete__in=athletes, sender="athlete", read_at__isnull=True, created_at__gte=since)
        .select_related("athlete")
        .order_by("-created_at")
    ):
        latest.setdefault(m.athlete_id, m)
    for m in latest.values():
        items.append({"kind": "message", "at": m.created_at, "athlete_id": m.athlete_id, "athlete_name": m.athlete.name, "text": m.preview[:80]})
    seen = set()
    for m in (
        Measurement.objects.filter(athlete__in=athletes, recorded_by="athlete", created_at__gte=since)
        .select_related("athlete")
        .order_by("-date", "-created_at")
    ):
        if m.athlete_id in seen:
            continue
        seen.add(m.athlete_id)
        items.append({"kind": "measurement", "at": _on_day(m.date, m.created_at), "athlete_id": m.athlete_id, "athlete_name": m.athlete.name})
    return items


CHECKIN_REMINDER = time(8, 0)


def athlete_notifications(athlete, since):
    items = []
    unread = Message.objects.filter(athlete=athlete, sender="coach", read_at__isnull=True, created_at__gte=since).order_by("-created_at")
    last = unread.first()
    if last:
        items.append({"kind": "message", "at": last.created_at, "coach_name": athlete.coach.user.name, "text": last.preview[:80], "value": unread.count()})
    for program in athlete.active_programs() or ([athlete.program] if athlete.program_id else []):
        if program.updated_at >= since and program.updated_at > program.created_at + timedelta(seconds=5):
            items.append({"kind": "program", "at": program.updated_at, "title": program.name})
        elif program.created_at >= since:
            items.append({"kind": "program.assigned", "at": program.created_at, "title": program.name})
    for log in athlete.workouts.filter(feedback_at__gte=since).order_by("-feedback_at")[:5]:
        items.append(
            {
                "kind": "feedback",
                "at": log.feedback_at,
                "workout_id": log.pk,
                "date": log.date,
                "title": log.focus,
                "text": (log.coach_feedback or [""])[-1],
                "coach_name": athlete.coach.user.name,
            }
        )
    plan = NutritionPlan.objects.filter(athlete=athlete, updated_at__gte=since, meals__isnull=False).distinct().first()
    if plan:
        items.append({"kind": "nutrition", "at": plan.updated_at})
    rplan = RecoveryPlan.objects.filter(athlete=athlete, updated_at__gte=since).first()
    if rplan:
        items.append({"kind": "recovery_plan", "at": rplan.updated_at})
    today = timezone.localdate()
    remind_at = timezone.make_aware(datetime.combine(today, CHECKIN_REMINDER))
    if timezone.now() >= remind_at and not RecoveryCheckIn.objects.filter(athlete=athlete, date=today).exists():
        items.append({"kind": "checkin", "at": remind_at})
    return items


def admin_notifications(since):
    items = []
    now = timezone.now()
    for c in Coach.objects.filter(status=AccountStatus.INVITED, created_at__lte=now - timedelta(days=2)).select_related("user"):
        items.append({"kind": "coach.invite_pending", "at": c.created_at + timedelta(days=2), "coach_id": c.pk, "coach_name": c.user.name})
    for c in Coach.objects.filter(status=AccountStatus.ACTIVE, athlete_cap__isnull=False).select_related("user"):
        n = c.athlete_count
        if c.athlete_cap and n >= 0.9 * c.athlete_cap:
            items.append({"kind": "coach.cap", "at": c.updated_at, "coach_id": c.pk, "coach_name": c.app_name, "value": round(100 * n / c.athlete_cap)})
    for c in Coach.objects.filter(status=AccountStatus.ACTIVE, expires_at__gt=now, expires_at__lte=now + timedelta(days=7)).select_related("user"):
        items.append(
            {
                "kind": "coach.expiring",
                "at": c.expires_at - timedelta(days=c.reminder_days or 2),
                "coach_id": c.pk,
                "coach_name": c.user.name,
                "value": c.days_left,
            }
        )
    from .models import AuditEvent

    for e in AuditEvent.objects.filter(action="coach.renewal_request", at__gte=since).select_related("actor"):
        items.append(
            {
                "kind": "coach.renewal_request",
                "at": e.at,
                "coach_id": int(e.target_id),
                "coach_name": e.actor.name if e.actor else "",
                "value": e.meta.get("days_left"),
            }
        )
    return items


class NotificationsView(APIView):
    @extend_schema(responses={200: dict})
    def get(self, request):
        since = timezone.now() - timedelta(days=WINDOW_DAYS)
        if is_athlete(request.user):
            items = athlete_notifications(request.user.athlete, since)
        else:
            _staff(request.user)
            items = coach_notifications(request.user.coach, since) if is_coach(request.user) else admin_notifications(since)
        items = sorted(items, key=lambda x: x["at"], reverse=True)[:LIMIT]
        seen = request.user.notifications_seen_at
        for x in items:
            x["unread"] = seen is None or x["at"] > seen
        return Response({"unread": sum(x["unread"] for x in items), "results": items})


class NotificationsReadView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        if not is_athlete(request.user):
            _staff(request.user)
        request.user.notifications_seen_at = timezone.now()
        request.user.save(update_fields=["notifications_seen_at"])
        return Response(status=204)
