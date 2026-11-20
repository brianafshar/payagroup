"""Program assignment, today's session and set logging (with automatic PR detection)."""

import copy
from datetime import date

from django.db import transaction
from django.utils import timezone

from coaching.models import Athlete, program_week_of

from .models import PY_WEEKDAY, LoggedSet, PersonalRecord, Program, WorkoutLog


@transaction.atomic
def assign(template: Program, athletes: list[Athlete], start: date, replace: bool = True) -> list[Program]:
    """Give each athlete their own copy of the program; later template edits never reach the copies.
    `replace` stops the athlete's other programs; otherwise it runs alongside them (#74)."""
    copies = []
    for athlete in athletes:
        p = Program.objects.create(
            coach=template.coach,
            name=template.name,
            goal=template.goal,
            sport=template.sport,
            time=template.time,
            description=template.description,
            kind=Program.Kind.COPY,
            template=template if template.kind == Program.Kind.TEMPLATE else template.template,
            athlete=athlete,
            version=template.version,
            duration_weeks=template.duration_weeks,
            sessions_per_week=template.sessions_per_week,
            weeks=copy.deepcopy(template.weeks),
        )
        p.sync_exercises()
        activate(p, start, replace=replace)
        copies.append(p)
    return copies


@transaction.atomic
def activate(program: Program, start: date, replace: bool = True) -> Program:
    """Make one of the athlete's programs run from `start` (#74: also to go back to an earlier or custom
    program). `replace` stops their other programs and makes this the main one; otherwise it runs
    alongside them and becomes the main one only if they had none."""
    athlete = program.athlete
    if replace:
        Program.objects.filter(athlete=athlete, active=True).exclude(pk=program.pk).update(active=False)
    program.active, program.start_date, program.archived = True, start, False
    program.save(update_fields=["active", "start_date", "archived"])
    main = athlete.program
    if replace or main is None or not main.active or main.archived or main.pk == program.pk:
        athlete.program, athlete.program_start = program, start
        athlete.save(update_fields=["program", "program_start"])
    notify_program_changed(athlete)
    return program


@transaction.atomic
def deactivate(program: Program) -> None:
    """Stop one of the athlete's programs; if it was the main one, the next running program takes over."""
    athlete = program.athlete
    program.active = False
    program.save(update_fields=["active"])
    if athlete is not None and athlete.program_id == program.pk:
        nxt = next(iter(athlete.active_programs()), None)
        athlete.program, athlete.program_start = nxt, nxt.start_date if nxt else None
        athlete.save(update_fields=["program", "program_start"])
    notify_program_changed(athlete)


def notify_program_changed(*athletes: Athlete) -> None:
    """Tell the athletes' open apps to reload their training (#74), once the change is committed."""
    from messaging.realtime import send_to_users

    ids = [a.user_id for a in athletes if a is not None and a.user_id]
    if ids:
        transaction.on_commit(lambda: send_to_users(ids, {"type": "program.changed"}))


def start_of(athlete: Athlete, program: Program | None):
    if program is None:
        return None
    if program.pk == athlete.program_id and athlete.program_start:
        return athlete.program_start  # the main program's start can be moved on the athlete
    return program.start_date


def session_for(athlete: Athlete, day: date, program: Program | None = None) -> dict:
    """What a program prescribes on `day` (the main program by default): `{program, week, weekday, day}`."""
    weekday = PY_WEEKDAY[day.weekday()]
    program = program or athlete.program
    start = start_of(athlete, program)
    if program is None or start is None or day < start:
        return {"program": program, "week": None, "weekday": weekday, "day": None}
    week = program_week_of(start, day)
    return {"program": program, "week": week, "weekday": weekday, "day": program.day(week, weekday) if week <= program.duration_weeks else None}


def sessions_for(athlete: Athlete, day: date) -> list[dict]:
    """`session_for` of every program the athlete follows, the main one first (#74)."""
    progs = athlete.active_programs()
    if athlete.program_id and all(p.pk != athlete.program_id for p in progs):
        progs.insert(0, athlete.program)  # main program from before #74 that isn't flagged active
    return [session_for(athlete, day, p) for p in progs] or [session_for(athlete, day)]


PART_ORDER = ["morning", "noon", "afternoon", "night", ""]
PART_FA = {"morning": "صبح", "noon": "ظهر", "afternoon": "عصر", "night": "شب", "": ""}


def slot_part(day: dict, slot: dict) -> str:
    return slot.get("time") or day.get("time") or ""


def day_parts(day: dict | None) -> list[str]:
    """The day's separately logged sessions: its distinct times in day order, or [''] for a single session."""
    times = {slot_part(day, x) for x in (day or {}).get("exercises") or []}
    return sorted(times, key=PART_ORDER.index) if len(times) > 1 else [""]


def part_slots(day: dict | None, part: str) -> list[int]:
    """Indexes of the day's exercises in `part` (all of them for a single-session day)."""
    exercises = (day or {}).get("exercises") or []
    if day_parts(day) == [""]:
        return list(range(len(exercises)))
    return [i for i, x in enumerate(exercises) if slot_part(day, x) == part]


def trains(s: dict) -> bool:
    d = s["day"] or {}
    return bool(d) and not d.get("rest") and bool(d.get("exercises"))


@transaction.atomic
def start_workout(athlete: Athlete, day: date, program: Program | None = None, part: str | None = None) -> WorkoutLog:
    """Open (or resume) a program's session for the day with every prescribed set prefilled as a target.
    A day with several times (morning, night…) has one session per `part`; without one, the first part
    not finished yet."""
    s = session_for(athlete, day, program)
    parts = day_parts(s["day"])
    if part not in parts:
        done = set(WorkoutLog.objects.filter(athlete=athlete, date=day, program=s["program"], finished_at__isnull=False).values_list("part", flat=True))
        part = next((x for x in parts if x not in done), parts[0])
    focus = (s["day"] or {}).get("focus", "")
    log, created = WorkoutLog.objects.select_for_update().get_or_create(
        athlete=athlete,
        date=day,
        program=s["program"],
        part=part,
        defaults={"week": s["week"], "weekday": s["weekday"], "focus": " · ".join(x for x in [focus, PART_FA.get(part, "")] if x)},
    )
    if log.status in (WorkoutLog.Status.PLANNED, WorkoutLog.Status.MISSED):
        log.status = WorkoutLog.Status.IN_PROGRESS
        log.started_at = log.started_at or timezone.now()
        log.save(update_fields=["status", "started_at"])
    if created and s["day"]:
        LoggedSet.objects.bulk_create(
            LoggedSet(
                log=log,
                exercise_id=slot["exercise_id"],
                slot=i,
                index=j,
                target_reps=st.get("reps", ""),
                target_value=st.get("value"),
                unit=st.get("unit", "kg"),
            )
            for i, slot in enumerate(s["day"].get("exercises", []))
            if i in part_slots(s["day"], part)
            for j, st in enumerate(slot.get("sets", []))
        )
    athlete.last_active_at = timezone.now()
    athlete.save(update_fields=["last_active_at"])
    return log


def update_pr(s: LoggedSet) -> PersonalRecord | None:
    """A done kg set is a PR when its load beats the athlete's best earlier load for at least as many reps
    (e.g. 72.5 kg × 8 beats a previous best of 70 kg × 8+). The first time an exercise is logged sets
    the baseline and isn't a PR. Undoing the set removes the record."""
    PersonalRecord.objects.filter(logged_set=s).delete()
    s.is_pr = False
    weight, reps = s.weight, s.reps
    if not s.done or s.unit != "kg" or not weight or not reps:
        return None
    earlier = (
        LoggedSet.objects.filter(log__athlete=s.log.athlete, exercise=s.exercise, done=True, unit="kg", log__date__lte=s.log.date)
        .exclude(pk=s.pk)
        .exclude(log=s.log, slot__gt=s.slot)
        .exclude(log=s.log, slot=s.slot, index__gt=s.index)
    )
    best = max((x.weight for x in earlier if x.weight and (x.reps or 0) >= reps), default=None)
    if best is None or weight <= best:
        return None
    s.is_pr = True
    return PersonalRecord.objects.create(
        athlete=s.log.athlete, exercise=s.exercise, type=f"{reps}RM", value=weight, unit="kg", date=s.log.date, previous=best, logged_set=s
    )


@transaction.atomic
def log_set(s: LoggedSet, *, done: bool, actual_reps: str | None = None, actual_value: float | None = None) -> LoggedSet:
    """Tick = done as prescribed; `actual_*` only when different from the target."""
    s.done = done
    s.actual_reps = "" if actual_reps in (None, s.target_reps) else actual_reps
    s.actual_value = None if actual_value is None or actual_value == s.target_value else actual_value
    update_pr(s)
    s.save()
    log = s.log
    if log.status == WorkoutLog.Status.PLANNED:
        log.status = WorkoutLog.Status.IN_PROGRESS
        log.started_at = log.started_at or timezone.now()
        log.save(update_fields=["status", "started_at"])
    return s


def finish_workout(log: WorkoutLog, *, rpe=None, note="", duration_min=None, avg_hr=None, **cardio) -> dict:
    sets = list(log.sets.all())
    done = sum(1 for s in sets if s.done)
    log.status = WorkoutLog.Status.COMPLETED if sets and done == len(sets) else WorkoutLog.Status.PARTIAL if done else WorkoutLog.Status.MISSED
    if log.finished_at:
        # Saved again after «ویرایش تمرین» (#64): recount the status, keep the original finish time,
        # duration, RPE and heart rate unless new values are sent.
        log.duration_min = duration_min if duration_min is not None else log.duration_min
        log.rpe = rpe if rpe is not None else log.rpe
        log.avg_hr = avg_hr if avg_hr is not None else log.avg_hr
    else:
        log.finished_at = timezone.now()
        if duration_min is None and log.started_at:
            duration_min = max(1, round((log.finished_at - log.started_at).total_seconds() / 60))
        log.duration_min, log.rpe, log.avg_hr = duration_min, rpe, avg_hr
    for k in ("distance_km", "max_hr", "cadence_spm", "elevation_m", "aerobic_te", "anaerobic_te", "lt_hr", "lt_pace"):
        if cardio.get(k) is not None:
            setattr(log, k, cardio[k])
    log.athlete_note = note or log.athlete_note
    log.save()
    prs = PersonalRecord.objects.filter(logged_set__log=log).select_related("exercise")
    return {
        "done": done,
        "total": len(sets),
        "volume_kg": log.volume_kg,
        "duration_min": log.duration_min,
        "prs": [{"exercise_id": p.exercise_id, "exercise_name": p.exercise.name, "type": p.type, "value": p.value, "previous": p.previous} for p in prs],
    }


@transaction.atomic
def set_attendance(athlete: Athlete, day: date, program: Program | None, part: str, present: bool | None) -> WorkoutLog:
    """Coach marks a session. Present: every prescribed set is logged as done (unless the coach already
    edited some) and the session is closed; absent: sets undone and the session counts as missed (no
    analytics); None: back to not marked."""
    log = start_workout(athlete, day, program, part)
    sets = list(log.sets.select_related("exercise", "log__athlete"))
    if present:
        if not any(s.done for s in sets):
            for s in sets:
                log_set(s, done=True, actual_reps=s.actual_reps or None, actual_value=s.actual_value)
        finish_workout(log)
        log.refresh_from_db()
    else:
        for s in sets:
            if s.done:
                log_set(s, done=False, actual_reps=s.actual_reps or None, actual_value=s.actual_value)
        log.status = WorkoutLog.Status.MISSED if present is False else WorkoutLog.Status.PLANNED
        log.finished_at = timezone.now() if present is False else None
        log.started_at = log.started_at if present is False else None
        log.save(update_fields=["status", "finished_at", "started_at"])
    return log
