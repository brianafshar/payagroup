from datetime import timedelta

from django.db.models import Count, F, Max, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from coaching.models import Athlete, program_week_of
from core import notify
from core.permissions import CoachWritesAthleteReads, IsAthlete, IsCoach, IsCoachOrAthlete, is_athlete, is_coach
from core.scoping import AthleteScopedMixin

from . import days, services
from .models import Exercise, LoggedSet, PersonalRecord, Program, WorkoutLog
from .serializers import (
    ActivateSerializer,
    AssignSerializer,
    ExerciseSerializer,
    FeedbackSerializer,
    FinishSerializer,
    LoggedSetSerializer,
    PersonalRecordSerializer,
    ProgramListSerializer,
    ProgramSerializer,
    SessionMetricsSerializer,
    WorkoutLogSerializer,
)


class ExerciseViewSet(viewsets.ModelViewSet):
    """Coach's exercise library (C14–C16). Athletes can read their coach's exercises (M37)."""

    serializer_class = ExerciseSerializer
    permission_classes = [CoachWritesAthleteReads]
    search_fields = ["name", "description"]
    filterset_fields = {"category": ["exact"], "equipment": ["exact"], "difficulty": ["exact"], "sport": ["exact"]}
    ordering_fields = ["name", "updated_at", "used"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Exercise.objects.none()
        user = self.request.user
        coach = user.coach if is_coach(user) else user.athlete.coach
        return Exercise.objects.filter(coach__in=coach.gym_ids()).annotate(used=Count("programs", filter=Q(programs__archived=False), distinct=True))

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user.coach)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"])
    def programs(self, request, pk=None):
        """C16 «used in N programs»: active programs containing the exercise, with the days it appears on."""
        if not is_coach(request.user):
            raise PermissionDenied()
        ex = self.get_object()
        out = []
        for p in ex.programs.filter(archived=False).select_related("athlete").order_by("kind", "name"):
            days = []
            for w in p.weeks or []:
                for d in w.get("days", []):
                    if any(x.get("exercise_id") == ex.pk for x in d.get("exercises", [])) and d.get("weekday") not in days:
                        days.append(d.get("weekday"))
            out.append(
                {
                    "id": p.pk,
                    "name": p.name,
                    "kind": p.kind,
                    "version": p.version,
                    "athlete_id": p.athlete_id,
                    "athlete_name": p.athlete.name if p.athlete_id else None,
                    "weekdays": days,
                }
            )
        return Response(out)

    def perform_destroy(self, instance):
        if instance.programs.exists() or LoggedSet.objects.filter(exercise=instance).exists():
            raise ValidationError({"detail": "Exercise is used by programs or logs."}, code="in_use")
        instance.delete()


@extend_schema(parameters=[OpenApiParameter("kind", str, description="template · copy · customized"), OpenApiParameter("athlete", int)])
class ProgramViewSet(viewsets.ModelViewSet):
    """Programs (C17–C22). Templates are assigned as per-athlete copies; editing a copy marks it customized.
    Athletes can read their own current program."""

    permission_classes = [CoachWritesAthleteReads]
    search_fields = ["name", "goal"]
    filterset_fields = ["kind", "athlete", "archived"]
    ordering_fields = ["updated_at", "name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Program.objects.none()
        user = self.request.user
        if is_athlete(user):
            return Program.objects.filter(athlete=user.athlete)
        qs = Program.objects.filter(
            Q(kind=Program.Kind.TEMPLATE, coach__in=user.coach.gym_ids()) | Q(athlete__coach__in=user.coach.athlete_scope_ids())
        ).select_related("athlete", "template")
        # Athletes following a copy of this one now (as their main program or alongside others).
        return qs.annotate(
            assigned_count=Count("copies__athlete", filter=Q(copies__active=True) | Q(copies__athlete__program_id=F("copies__id")), distinct=True),
            exercise_count=Count("exercises", distinct=True),
        ).order_by("-updated_at")

    def get_serializer_class(self):
        return ProgramListSerializer if self.action == "list" else ProgramSerializer

    def perform_create(self, serializer):
        """`forAthlete: <id>` creates a one-athlete program (not a template) and makes it theirs from today."""
        coach = self.request.user.coach
        athlete_id = self.request.data.get("for_athlete")
        if not athlete_id:
            serializer.save(coach=coach, kind=Program.Kind.TEMPLATE)
            return
        athlete = Athlete.objects.filter(coach__in=coach.athlete_scope_ids(), pk=athlete_id).first()
        if athlete is None:
            raise ValidationError({"for_athlete": "Unknown athlete."})
        program = serializer.save(coach=coach, kind=Program.Kind.CUSTOMIZED, athlete=athlete)
        replace = str(self.request.data.get("replace", "true")).lower() not in ("false", "0")
        services.activate(program, timezone.localdate(), replace=replace)

    def perform_update(self, serializer):
        program = serializer.save()
        if program.athlete_id:  # an athlete's program was edited: their app reloads it (#74)
            services.notify_program_changed(program.athlete)

    def perform_destroy(self, instance):
        """Templates are archived (athlete copies and history keep working); unused copies are deleted.
        `?permanent=true` deletes for good (#77): logged workouts stay in the history without the program,
        athlete copies of a template stay as they are, and an athlete whose current program it was has none."""
        if self.request.query_params.get("permanent") in ("1", "true"):
            instance.delete()
            return
        if instance.kind == Program.Kind.TEMPLATE or instance.logs.exists():
            instance.archived = True
            instance.save(update_fields=["archived"])
        else:
            instance.delete()

    @extend_schema(request=AssignSerializer, responses=ProgramListSerializer(many=True))
    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """C21: copy this program to each athlete and make it their current program from `startDate`."""
        program = self.get_object()
        s = AssignSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ids = set(s.validated_data["athlete_ids"])
        athletes = list(Athlete.objects.filter(coach__in=request.user.coach.athlete_scope_ids(), pk__in=ids))
        if len(athletes) != len(ids):
            raise ValidationError({"athlete_ids": "Unknown athletes."})
        copies = services.assign(program, athletes, s.validated_data.get("start_date") or timezone.localdate(), replace=s.validated_data["replace"])
        sms_status = {a.pk: notify.send_program_assigned(a, sent_by=request.user, base_url=request.build_absolute_uri("/")) for a in athletes}
        return Response(ProgramListSerializer(copies, many=True, context={"request": request}).data, status=status.HTTP_201_CREATED, headers={"X-SMS-Sent": str(sum(v == "sent" for v in sms_status.values()))})

    @extend_schema(request=ActivateSerializer, responses=ProgramSerializer)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """#74: (re)start one of an athlete's programs — e.g. back to their custom program after a template
        replaced it. `replace: false` runs it alongside their other programs."""
        program = self.get_object()
        if program.athlete_id is None:
            raise ValidationError({"detail": "Assign a template to athletes instead."})
        s = ActivateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.activate(program, s.validated_data.get("start_date") or timezone.localdate(), replace=s.validated_data["replace"])
        program.refresh_from_db()
        data = ProgramSerializer(program, context={"request": request}).data
        data["sms_status"] = notify.send_program_assigned(program.athlete, sent_by=request.user, base_url=request.build_absolute_uri("/"))
        return Response(data)

    @extend_schema(request=None, responses=ProgramSerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """#74: stop one of an athlete's programs (kept in their list, can be started again)."""
        program = self.get_object()
        if program.athlete_id is None:
            raise ValidationError({"detail": "Only athlete programs can be stopped."})
        services.deactivate(program)
        program.refresh_from_db()
        return Response(ProgramSerializer(program, context={"request": request}).data)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"])
    def copies(self, request, pk=None):
        """C20: athlete copies of this template, with their version and progress."""
        from coaching.stats import adherence_pct

        template = self.get_object()
        rows = []
        for c in template.copies.select_related("athlete").order_by("-updated_at"):
            a = c.athlete
            current = a is not None and (c.active or a.program_id == c.pk)
            rows.append(
                {
                    "id": c.pk,
                    "athlete_id": a.pk if a else None,
                    "athlete_name": a.name if a else "",
                    "athlete_status": a.status if a else "",
                    "kind": c.kind,
                    "version": c.version,
                    "current": current,
                    "start": services.start_of(a, c) if current else None,
                    "week": program_week_of(services.start_of(a, c), timezone.localdate()) if current and services.start_of(a, c) else None,
                    "duration_weeks": c.duration_weeks,
                    "adherence_pct": adherence_pct(a) if current else None,
                }
            )
        return Response(rows)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"], url_path="push-update")
    def push_update(self, request, pk=None):
        """Give the latest template version to chosen athlete copies. Customized copies are never overwritten."""
        template = self.get_object()
        ids = request.data.get("copy_ids") or []
        updated = 0
        for c in template.copies.filter(pk__in=ids, kind=Program.Kind.COPY):
            c.weeks, c.version = template.weeks, template.version
            c.duration_weeks, c.sessions_per_week = template.duration_weeks, template.sessions_per_week
            c.save()
            c.sync_exercises()
            updated += 1
        return Response({"updated": updated})

    @extend_schema(request=None, responses=ProgramSerializer)
    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        src = self.get_object()
        dup = Program.objects.create(
            coach=src.coach, name=f"{src.name} (کپی)", goal=src.goal, sport=src.sport, time=src.time, description=src.description, kind=Program.Kind.TEMPLATE,
            duration_weeks=src.duration_weeks, sessions_per_week=src.sessions_per_week, weeks=src.weeks,
        )  # fmt: skip
        dup.sync_exercises()
        return Response(ProgramSerializer(dup, context={"request": request}).data, status=status.HTTP_201_CREATED)


@extend_schema(parameters=[OpenApiParameter("athlete", int), OpenApiParameter("from", str), OpenApiParameter("to", str)])
class WorkoutLogViewSet(AthleteScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Training history (C23, M36–M39). Coach: their athletes' logs + feedback. Athlete: own logs, start/finish."""

    serializer_class = WorkoutLogSerializer
    permission_classes = [IsCoachOrAthlete]
    queryset = WorkoutLog.objects.select_related("athlete", "program").prefetch_related("sets__exercise")
    filterset_fields = ["status"]
    ordering_fields = ["date"]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("from"):
            qs = qs.filter(date__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(date__lte=p["to"])
        return qs

    @extend_schema(request=serializers.Serializer, responses=WorkoutLogSerializer)
    @action(detail=False, methods=["post"], permission_classes=[IsAthlete])
    def start(self, request):
        """Open today's session (prefills every prescribed set as a target). Idempotent. With several
        programs (#74) `program` picks which one; default: the main program. A day with several times
        has a session per `part` (morning · noon · afternoon · night); default: the first not finished."""
        athlete = request.user.athlete
        log = services.start_workout(athlete, timezone.localdate(), _athlete_program(athlete, request.data.get("program")), request.data.get("part"))
        return Response(WorkoutLogSerializer(log, context={"request": request}).data)

    @extend_schema(request=FinishSerializer, responses={200: dict})
    @action(detail=True, methods=["post"], permission_classes=[IsAthlete])
    def finish(self, request, pk=None):
        """M39: completed when every set is done, partial otherwise. Returns the summary (volume, PRs)."""
        log = self.get_object()
        s = FinishSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(services.finish_workout(log, **s.validated_data))

    @extend_schema(request=SessionMetricsSerializer, responses=WorkoutLogSerializer)
    @action(detail=True, methods=["patch"])
    def metrics(self, request, pk=None):
        """Correct a session's duration, RPE, heart rate and cardio details (athlete: own; coach: their athletes)."""
        log = self.get_object()
        s = SessionMetricsSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        for k, v in s.validated_data.items():
            setattr(log, k, v)
        log.save(update_fields=list(s.validated_data) or None)
        return Response(WorkoutLogSerializer(log, context={"request": request}).data)

    @extend_schema(request=FeedbackSerializer, responses=WorkoutLogSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsCoach])
    def feedback(self, request, pk=None):
        log = self.get_object()
        s = FeedbackSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        text = s.validated_data["text"]
        log.coach_feedback = [*log.coach_feedback, text]
        log.feedback_at = timezone.now()
        log.save(update_fields=["coach_feedback", "feedback_at"])
        # #62: the athlete hears about it — push (when available) and the in-app notifications list.
        athlete = log.athlete
        if not athlete.coach.in_quiet_hours():
            from messaging import push

            title = "بازخورد مربی" + (" · " + log.focus if log.focus else "")
            push.notify([athlete.user_id], title, text, {"type": "feedback", "workoutId": log.pk})
        return Response(WorkoutLogSerializer(log, context={"request": request}).data)


class LoggedSetViewSet(mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """M38: tick a set (done as prescribed) or record what was actually done. Undo with `done: false`."""

    serializer_class = LoggedSetSerializer
    permission_classes = [IsCoachOrAthlete]
    http_method_names = ["patch"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return LoggedSet.objects.none()
        qs = LoggedSet.objects.select_related("log__athlete", "exercise")
        if is_coach(self.request.user):  # the coach corrects what was done (weights, reps) for their athletes
            return qs.filter(log__athlete__coach__in=self.request.user.coach.athlete_scope_ids())
        return qs.filter(log__athlete=self.request.user.athlete)

    def partial_update(self, request, pk=None):
        s = self.get_object()
        if is_athlete(request.user) and s.log.status in (WorkoutLog.Status.COMPLETED, WorkoutLog.Status.MISSED) and s.log.date < timezone.localdate():
            raise PermissionDenied("This session is closed.")
        data = LoggedSetSerializer(s, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        services.log_set(
            s, done=v.get("done", s.done), actual_reps=v.get("actual_reps", s.actual_reps or None), actual_value=v.get("actual_value", s.actual_value)
        )
        if is_coach(request.user) and s.log.finished_at and s.log.status != WorkoutLog.Status.MISSED:
            services.finish_workout(s.log)  # recount completed / partial after the correction
        return Response(LoggedSetSerializer(s).data)


class PersonalRecordViewSet(AthleteScopedMixin, viewsets.ModelViewSet):
    """PRs (C31, M44). Detected automatically from logged sets; coaches can also record them manually."""

    serializer_class = PersonalRecordSerializer
    permission_classes = [CoachWritesAthleteReads]
    queryset = PersonalRecord.objects.select_related("exercise", "athlete")
    filterset_fields = ["exercise", "type"]
    ordering_fields = ["date", "value"]

    def perform_create(self, serializer):
        serializer.save(athlete=self.target_athlete(serializer), created_by=self.request.user)


class TodayView(APIView):
    """M35/M36: today's prescription merged with what has been logged so far."""

    permission_classes = [IsAthlete]

    @extend_schema(parameters=[OpenApiParameter("date", str)], responses={200: dict})
    def get(self, request):
        athlete = request.user.athlete
        day = request.query_params.get("date")
        day = timezone.datetime.fromisoformat(day).date() if day else timezone.localdate()
        # Several programs (#74): every program's session today, and the chosen one (`?program=`;
        # default: the first that trains today, else the main program) in full.
        # A day with several times has one session per part (morning, night…), each logged on its own.
        all_ = services.sessions_for(athlete, day)
        logs = {(x.program_id, x.part): x for x in WorkoutLog.objects.filter(athlete=athlete, date=day)}
        open_ = lambda x: any((x["program"].pk, p) not in logs for p in services.day_parts(x["day"]))  # noqa: E731 - a session not started yet
        chosen = _athlete_program(athlete, request.query_params.get("program"))
        s = next((x for x in all_ if chosen and x["program"] and x["program"].pk == chosen.pk), None)
        s = s or next((x for x in all_ if services.trains(x) and x["program"] and open_(x)), None)
        s = s or next((x for x in all_ if services.trains(x)), None) or all_[0]
        pid = s["program"].pk if s["program"] else None
        parts = services.day_parts(s["day"])
        part = request.query_params.get("part", None)
        if part not in parts:  # default: the part under way, else the first not started yet
            fresh = [p for p in parts if (pid, p) not in logs]
            unfinished = [p for p in parts if (pid, p) in logs and not logs[(pid, p)].finished_at]
            part = (unfinished or fresh or parts)[0]
        log = WorkoutLog.objects.filter(athlete=athlete, date=day, program_id=pid, part=part).prefetch_related("sets").first()
        logged = {(x.slot, x.index): x for x in log.sets.all()} if log else {}
        rx = s["day"] or {}
        ex_ids = [slot["exercise_id"] for slot in rx.get("exercises", [])]
        exercises = {e.pk: e for e in Exercise.objects.filter(pk__in=ex_ids)}
        best = _best_loads(athlete, ex_ids)
        items = []
        mine = set(services.part_slots(rx, part))
        for i, slot in enumerate(rx.get("exercises", [])):
            if i not in mine:
                continue
            ex = exercises.get(slot["exercise_id"])
            items.append(
                {
                    "slot": i,
                    "time": slot.get("time") or rx.get("time", ""),
                    "exercise": ExerciseSerializer(ex, context={"request": request}).data if ex else None,
                    "note": slot.get("note", ""),
                    "best_kg": best.get(slot["exercise_id"]),
                    "sets": [
                        {**st, "logged": LoggedSetSerializer(logged[(i, j)]).data if (i, j) in logged else None} for j, st in enumerate(slot.get("sets", []))
                    ],
                }
            )
        program = s["program"]
        return Response(
            {
                "date": day,
                "program": {"id": program.pk, "name": program.name, "duration_weeks": program.duration_weeks} if program else None,
                "week": s["week"],
                "weekday": s["weekday"],
                "rest": bool(rx.get("rest")) or not items,
                "focus": rx.get("focus", ""),
                "part": part,
                "exercises": items,
                "log": WorkoutLogSerializer(log, context={"request": request}).data if log else None,
                "sessions": [
                    {
                        "program_id": x["program"].pk,
                        "part": p,
                        "name": x["program"].name,
                        "sport": x["program"].sport,
                        "focus": " · ".join(y for y in [services.PART_FA.get(p, ""), (x["day"] or {}).get("focus", "")] if y),
                        "rest": not services.trains(x),
                        "status": logs[(x["program"].pk, p)].status if (x["program"].pk, p) in logs else None,
                        "selected": x["program"].pk == pid and p == part,
                    }
                    for x in all_
                    if x["program"]
                    for p in services.day_parts(x["day"])
                ],
            }
        )


class ScheduleView(APIView):
    """The athlete's program ahead (and behind): `?start=YYYY-MM-DD&days=7` (default: this Saturday-first
    week, up to 42 days). Each day has the week number, focus, rest flag, the prescribed exercises with
    their sets, and the logged session's status if there is one."""

    permission_classes = [IsAthlete]

    @extend_schema(parameters=[OpenApiParameter("start", str), OpenApiParameter("days", int)], responses={200: dict})
    def get(self, request):
        athlete = request.user.athlete
        today = timezone.localdate()
        try:
            start = timezone.datetime.fromisoformat(request.query_params["start"]).date() if request.query_params.get("start") else None
        except ValueError:
            raise ValidationError({"start": "Use YYYY-MM-DD."}) from None
        start = start or today - timedelta(days=(today.weekday() - 5) % 7)  # this week's Saturday
        n = request.query_params.get("days", "7")
        n = min(42, max(1, int(n))) if n.isdigit() else 7
        dates = [start + timedelta(days=i) for i in range(n)]
        all_logs = list(WorkoutLog.objects.filter(athlete=athlete, date__in=dates))
        others = [p for p in athlete.active_programs() if p.pk != athlete.program_id]
        # The main program's session for the day; a log of another active program belongs to that program's
        # line (`also`), not to the day (#89). Logs of a program no longer followed still show here.
        other_ids = {p.pk for p in others}
        logs = {x.date: x for x in all_logs if x.program_id == athlete.program_id}
        logs.update({x.date: x for x in all_logs if x.date not in logs and x.program_id not in other_ids})
        # A day with several sessions (#parts): the day's status combines them.
        parts_of = {}
        for x in all_logs:
            if x.program_id == athlete.program_id:
                parts_of.setdefault(x.date, []).append(x.status)
        plans = [services.session_for(athlete, d) for d in dates]
        extra = {d: [services.session_for(athlete, d, p) for p in others] for d in dates}
        ex_ids = {slot["exercise_id"] for p in plans for slot in ((p["day"] or {}).get("exercises") or [])}
        names = {e.pk: e for e in Exercise.objects.filter(pk__in=ex_ids)}
        pics = ExerciseSerializer(context={"request": request})  # picture URLs (coach's own or the library's)
        out = []
        for d, p in zip(dates, plans, strict=True):
            rx = p["day"] or {}
            exercises = []
            for slot in rx.get("exercises") or []:
                ex = names.get(slot["exercise_id"])
                sets = slot.get("sets") or []
                first = sets[0] if sets else {}
                exercises.append(
                    {
                        "exercise_id": slot["exercise_id"],
                        "name": ex.name if ex else "حرکت",
                        "category": ex.category if ex else "",
                        "sets": len(sets),
                        "reps": first.get("reps", ""),
                        "value": first.get("value"),
                        "unit": first.get("unit", "kg"),
                        "rest_sec": first.get("rest_sec"),
                        "note": slot.get("note", ""),
                        "time": slot.get("time") or rx.get("time", ""),
                        "image_src": pics.get_image_src(ex) if ex else None,
                        "image_start_src": pics.get_image_start_src(ex) if ex else None,
                    }
                )
            log = logs.get(d)
            rest = bool(rx.get("rest")) or not exercises
            if log and (not rest or log.status in days.DONE):
                status_ = _combine(parts_of.get(d) or [log.status], len(services.day_parts(p["day"])))
            elif d >= today:
                status_ = None
            else:  # #89: a past rest day was done by resting; a past session with no log was missed
                status_ = "rest" if rest else "missed"
            out.append(
                {
                    "date": d,
                    "weekday": p["weekday"],
                    "week": p["week"],
                    "focus": rx.get("focus", ""),
                    "time": rx.get("time", ""),
                    "rest": rest,
                    "exercises": exercises,
                    "status": status_,
                    "workout_id": log.pk if log else None,
                    "today": d == today,
                    # Sessions of the athlete's other programs that day (#74).
                    "also": [
                        {
                            "program_id": x["program"].pk,
                            "name": x["program"].name,
                            "focus": (x["day"] or {}).get("focus", ""),
                            "time": (x["day"] or {}).get("time", ""),
                            "exercises": len((x["day"] or {}).get("exercises") or []),
                            "status": next((g.status for g in all_logs if g.date == d and g.program_id == x["program"].pk), None if d >= today else "missed"),
                        }
                        for x in extra[d]
                        if services.trains(x)
                    ],
                }
            )
        program = athlete.program
        return Response(
            {
                "start": start,
                "days": out,
                "program": (
                    {
                        "name": program.name,
                        "duration_weeks": program.duration_weeks,
                        "start": athlete.program_start,
                        "end": athlete.program_start + timedelta(weeks=program.duration_weeks, days=-1) if athlete.program_start else None,
                    }
                    if program
                    else None
                ),
            }
        )


def _combine(statuses: list[str], expected: int) -> str:
    """One status for a day of several sessions: completed only when every one is."""
    if len(statuses) == expected and all(s == "completed" for s in statuses):
        return "completed"
    if "in-progress" in statuses:
        return "in-progress"
    if any(s in ("completed", "partial") for s in statuses):
        return "partial"
    return statuses[0] if statuses else "planned"


def _athlete_program(athlete, pid):
    """One of the athlete's own programs by id (from a request), or None for the main one."""
    if not pid or not str(pid).isdigit():
        return None
    p = Program.objects.filter(athlete=athlete, pk=pid).first()
    if p is None:
        raise ValidationError({"program": "Unknown program."})
    return p


def _best_loads(athlete, exercise_ids) -> dict:
    rows = (
        LoggedSet.objects.filter(log__athlete=athlete, exercise_id__in=exercise_ids, done=True, unit="kg")
        .values("exercise_id")
        .annotate(w=Max(Coalesce("actual_value", "target_value")))
    )
    return {r["exercise_id"]: r["w"] for r in rows}


class AttendanceView(APIView):
    """Coach attendance. `GET attendance/?date=` lists the coach's athletes with the sessions their programs
    prescribe that day and whether attendance was marked. `POST attendance/` `{athlete, date?, program?, part?,
    present: true|false|null}`: present → the session is logged as prescribed (counts in analytics; weights and
    reps can then be edited per set) · absent → missed (no sets count) · null → cleared."""

    permission_classes = [IsCoach]

    class Input(serializers.Serializer):
        athlete = serializers.IntegerField()
        date = serializers.DateField(required=False)
        program = serializers.IntegerField(required=False, allow_null=True)
        part = serializers.CharField(required=False, allow_blank=True, default="")
        present = serializers.BooleanField(allow_null=True)

    @staticmethod
    def _day(request):
        raw = request.query_params.get("date") or request.data.get("date")
        try:
            day = timezone.datetime.fromisoformat(raw).date() if raw else timezone.localdate()
        except ValueError as e:
            raise ValidationError({"date": "Invalid date."}) from e
        if day > timezone.localdate():
            raise ValidationError({"date": "Attendance can't be marked for a future day."})
        return day

    @extend_schema(parameters=[OpenApiParameter("date", str)], responses={200: dict})
    def get(self, request):
        day = self._day(request)
        athletes = list(Athlete.objects.filter(coach__in=request.user.coach.athlete_scope_ids()).order_by("name"))
        logs = {}
        for x in WorkoutLog.objects.filter(athlete__in=athletes, date=day):
            logs[(x.athlete_id, x.program_id, x.part)] = x
        rows = []
        for a in athletes:
            sessions = []
            for s in services.sessions_for(a, day):
                if not services.trains(s) or not s["program"]:
                    continue
                for part in services.day_parts(s["day"]):
                    log = logs.get((a.pk, s["program"].pk, part))
                    present = None if not log or log.status in (WorkoutLog.Status.PLANNED, WorkoutLog.Status.IN_PROGRESS) else log.status != WorkoutLog.Status.MISSED
                    sessions.append(
                        {
                            "program_id": s["program"].pk,
                            "program_name": s["program"].name,
                            "part": part,
                            "part_label": services.PART_FA.get(part, ""),
                            "focus": s["day"].get("focus", ""),
                            "log_id": log.pk if log else None,
                            "status": log.status if log else None,
                            "present": present,
                        }
                    )
            rows.append({"athlete_id": a.pk, "name": a.name, "sessions": sessions})
        return Response({"date": day, "athletes": rows})

    @extend_schema(request=Input, responses=WorkoutLogSerializer)
    def post(self, request):
        s = self.Input(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        day = self._day(request)
        athlete = Athlete.objects.filter(coach__in=request.user.coach.athlete_scope_ids(), pk=d["athlete"]).first()
        if not athlete:
            raise ValidationError({"athlete": "Unknown athlete."})
        program = Program.objects.filter(pk=d["program"]).first() if d.get("program") else None
        if not services.trains(services.session_for(athlete, day, program)):
            raise ValidationError({"detail": "This athlete has no training prescribed on that day."})
        log = services.set_attendance(athlete, day, program, d.get("part", ""), d["present"])
        return Response(WorkoutLogSerializer(log, context={"request": request}).data)
