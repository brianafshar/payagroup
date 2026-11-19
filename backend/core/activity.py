"""Activity analytics for admins: who is online, active users per day, sign-ins per device, and time
spent per section of the panel and the app (reported by the clients, see `SectionUsage`)."""

import re
from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, F, Max, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import LoginSession, User

from .models import SectionUsage
from .permissions import AdminPerm

SECTION = re.compile(r"^[a-z][A-Za-z0-9:_.-]{0,39}$")
MAX_SECONDS = 600  # one report covers at most ~10 minutes of one section
ONLINE = timedelta(minutes=5)


class ReportSerializer(serializers.Serializer):
    class Item(serializers.Serializer):
        section = serializers.CharField(max_length=40)
        seconds = serializers.IntegerField(min_value=0)
        visits = serializers.IntegerField(min_value=0, default=0)

    items = Item(many=True, max_length=30)


class ActivityReportView(APIView):
    """Clients report time per section every ~30 s (only while visible and in use): `{items: [{section,
    seconds, visits}]}`. Sections are route keys like `coach:chat` or `app:Workout`."""

    @extend_schema(request=ReportSerializer, responses={204: None})
    def post(self, request):
        s = ReportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        today = timezone.localdate()
        for it in s.validated_data["items"]:
            sec = it["section"].strip()
            if not SECTION.match(sec):
                raise ValidationError({"section": "Unknown section format."})
            seconds, visits = min(MAX_SECONDS, it["seconds"]), min(50, it["visits"])
            if not seconds and not visits:
                continue
            row, created = SectionUsage.objects.get_or_create(user=request.user, date=today, section=sec, defaults={"seconds": seconds, "visits": visits})
            if not created:
                SectionUsage.objects.filter(pk=row.pk).update(seconds=F("seconds") + seconds, visits=F("visits") + visits)
        return Response(status=204)


def _days(request, default=30) -> int:
    try:
        return min(365, max(1, int(request.query_params.get("days", default))))
    except ValueError:
        return default


class AdminActivityView(APIView):
    """Platform activity (admins with `rep`): online now, active users per day, sign-ins, and minutes per
    section for coaches and athletes (`?days=7|30|90`)."""

    permission_classes = [AdminPerm("rep")]

    @extend_schema(parameters=[OpenApiParameter("days", int)], responses={200: dict})
    def get(self, request):
        days = _days(request)
        now = timezone.now()
        today = timezone.localdate()
        since = today - timedelta(days=days - 1)

        online = (
            LoginSession.objects.filter(ended_at__isnull=True, last_seen_at__gte=now - ONLINE).values("user__role").annotate(n=Count("user", distinct=True))
        )
        usage = SectionUsage.objects.filter(date__gte=since)

        def active(d0):
            return dict(usage.filter(date__gte=d0).values_list("user__role").annotate(n=Count("user", distinct=True)))

        daily = defaultdict(lambda: {"coach": 0, "athlete": 0, "admin": 0})
        for d, role, n in usage.values_list("date", "user__role").annotate(n=Count("user", distinct=True)):
            daily[d][role] = n
        sections = [
            {"section": r["section"], "role": r["user__role"], "minutes": round(r["s"] / 60, 1), "users": r["u"], "visits": r["v"]}
            for r in usage.values("section", "user__role").annotate(s=Sum("seconds"), u=Count("user", distinct=True), v=Sum("visits")).order_by("-s")
        ]
        top = usage.values("user", "user__name", "user__role").annotate(s=Sum("seconds"), last=Max("date")).order_by("-s")[:50]
        fav = {}
        for r in usage.values("user", "section").annotate(s=Sum("seconds")).order_by("user", "-s"):
            fav.setdefault(r["user"], r["section"])
        last_seen = dict(LoginSession.objects.filter(user__in=[r["user"] for r in top]).values_list("user").annotate(m=Max("last_seen_at")))
        logins = LoginSession.objects.filter(created_at__date__gte=since).select_related("user").order_by("-created_at")
        return Response(
            {
                "days": days,
                "online": {r["user__role"]: r["n"] for r in online},
                "active_today": active(today),
                "active_7d": active(today - timedelta(days=6)),
                "active_range": active(since),
                "sign_ins": logins.count(),
                "daily": [{"date": since + timedelta(days=i), **daily[since + timedelta(days=i)]} for i in range(days)],
                "sections": sections,
                "users": [
                    {
                        "user_id": r["user"],
                        "name": r["user__name"],
                        "role": r["user__role"],
                        "minutes": round(r["s"] / 60, 1),
                        "top_section": fav.get(r["user"], ""),
                        "last_seen": last_seen.get(r["user"]),
                    }
                    for r in top
                ],
                "recent_logins": [
                    {
                        "user_id": s.user_id,
                        "name": s.user.name,
                        "role": s.user.role,
                        "device": s.device,
                        "at": s.created_at,
                        "last_seen": s.last_seen_at,
                        "active": s.active,
                        "online": s.ended_at is None and s.last_seen_at >= now - ONLINE,
                    }
                    for s in logins[:40]
                ],
            }
        )


class AdminUserActivityView(APIView):
    """One user's activity (admins with `rep`): minutes per section and per day, and their sign-ins."""

    permission_classes = [AdminPerm("rep")]

    @extend_schema(parameters=[OpenApiParameter("days", int)], responses={200: dict})
    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        days = _days(request)
        since = timezone.localdate() - timedelta(days=days - 1)
        usage = SectionUsage.objects.filter(user=user, date__gte=since)
        per_day = dict(usage.values_list("date").annotate(s=Sum("seconds")))
        return Response(
            {
                "user_id": user.pk,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "days": days,
                "sections": [
                    {"section": r["section"], "minutes": round(r["s"] / 60, 1), "visits": r["v"]}
                    for r in usage.values("section").annotate(s=Sum("seconds"), v=Sum("visits")).order_by("-s")
                ],
                "daily": [{"date": since + timedelta(days=i), "minutes": round(per_day.get(since + timedelta(days=i), 0) / 60, 1)} for i in range(days)],
                "sign_ins": [
                    {"device": s.device, "at": s.created_at, "last_seen": s.last_seen_at, "ended_by": s.ended_by, "active": s.active}
                    for s in user.login_sessions.filter(created_at__date__gte=since)[:30]
                ],
            }
        )


class PublicInfoView(APIView):
    """What signed-out pages need: the support email (help and privacy pages, login screens)."""

    permission_classes = []
    authentication_classes = []

    @extend_schema(responses={200: dict})
    def get(self, request):
        from django.conf import settings

        return Response({"support_email": settings.SUPPORT_EMAIL})
