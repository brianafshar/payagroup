import re

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from coaching.models import Athlete, Coach
from core.uploads import image_upload_to, validate_photo, validate_video, video_upload_to

WEEKDAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"]
"""Saturday-first Persian week; Friday is a valid training day."""

# Python's date.weekday(): Monday = 0 … Sunday = 6
PY_WEEKDAY = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def first_int(reps: str) -> int | None:
    """`"8"` → 8, `"8-10"` → 8 (the lower bound is what must be beaten), `"AMRAP"` → None."""
    m = re.search(r"\d+", reps or "")
    return int(m.group()) if m else None


class Exercise(models.Model):
    """Coach's exercise library entry (C14–C16), optionally with the coach's own video."""

    class Difficulty(models.TextChoices):
        BEGINNER = "beginner"
        INTERMEDIATE = "intermediate"
        ADVANCED = "advanced"

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name="exercises")
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=30)
    equipment = models.CharField(max_length=30)
    difficulty = models.CharField(max_length=15, choices=Difficulty.choices, default=Difficulty.INTERMEDIATE)
    video = models.FileField(upload_to=video_upload_to, blank=True, validators=[validate_video])
    video_url = models.URLField(blank=True)
    image = models.FileField(upload_to=image_upload_to, blank=True, validators=[validate_photo], help_text="Cover image (C15).")
    stock_image = models.CharField(max_length=200, blank=True, help_text="Shared photo from the standard library (storage path); the coach's own `image` wins.")
    duration = models.CharField(max_length=8, blank=True, help_text="Video length, m:ss.")
    metrics = models.JSONField(default=list, blank=True)
    sport = models.CharField(max_length=40, blank=True)
    measure = models.CharField(max_length=40, blank=True)
    unit = models.CharField(max_length=10, default="kg")
    description = models.TextField(blank=True)
    cues = models.JSONField(default=list, blank=True, help_text="Tips and common mistakes.")
    # Standard library v2: how to do it, what it trains, what it helps with, and its band / no-equipment
    # alternatives (by `library_key`, resolved to this coach's exercises when read).
    library_key = models.CharField(max_length=80, blank=True, db_index=True)
    steps = models.JSONField(default=list, blank=True)
    muscles_primary = models.JSONField(default=list, blank=True)
    muscles_secondary = models.JSONField(default=list, blank=True)
    issues = models.JSONField(default=list, blank=True, help_text="Corrective issue keys (posture, knee, shoulder…).")
    alternatives = models.JSONField(default=dict, blank=True, help_text="{band: [key], home: [key], replaces: [key]}")
    stock_image_start = models.CharField(max_length=200, blank=True, help_text="Start pose of the library illustration; `stock_image` is the end pose.")
    illustration_match = models.CharField(max_length=10, blank=True, help_text="exact · approx (a look-alike movement) · none")
    badge = models.CharField(max_length=20, blank=True, help_text="band: the picture shows the cable/dumbbell version.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Program(models.Model):
    """Training program. Templates are copied per athlete on assignment; edits never flow back.

    `weeks` holds the builder tree (always read and saved whole):
    `[{index, days: [{weekday, focus, rest, exercises: [{exercise_id, note, sets: [{reps, value, unit, rest_sec, rpe}]}]}]}]`.
    `exercises` indexes the exercises used, for "used in N programs" and integrity checks.
    """

    class Kind(models.TextChoices):
        TEMPLATE = "template"
        COPY = "copy"
        CUSTOMIZED = "customized"

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name="programs")
    name = models.CharField(max_length=120)
    goal = models.CharField(max_length=60, blank=True)
    sport = models.CharField(max_length=20, default="fitness", help_text="fitness, running, swimming, cycling, …")
    time = models.CharField(
        max_length=10, blank=True, help_text="Default part of the day for its sessions: morning · noon · afternoon · night; a day's own `time` wins."
    )
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TEMPLATE)
    template = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="copies")
    athlete = models.ForeignKey(Athlete, null=True, blank=True, on_delete=models.CASCADE, related_name="programs")
    version = models.PositiveIntegerField(default=1)
    duration_weeks = models.PositiveSmallIntegerField(default=4, validators=[MinValueValidator(1), MaxValueValidator(52)])
    sessions_per_week = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(0), MaxValueValidator(7)])
    weeks = models.JSONField(default=list, blank=True)
    exercises = models.ManyToManyField(Exercise, blank=True, related_name="programs")
    archived = models.BooleanField(default=False)
    # Athlete programs (#74): an athlete can follow several at once (e.g. running + bodybuilding). `active`
    # marks the ones running now, each from its own `start_date`; `athlete.program` is the main one.
    active = models.BooleanField(default=False)
    start_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name

    def exercise_ids(self) -> set[int]:
        return {ex["exercise_id"] for w in self.weeks for d in w.get("days", []) for ex in d.get("exercises", [])}

    def sync_exercises(self) -> None:
        self.exercises.set(self.exercise_ids())

    def day(self, week: int, weekday: str) -> dict | None:
        """Prescription for a week (1-based, repeating the last week past the end) and weekday. Its `time`
        is the day's own, else the program's."""
        if not self.weeks:
            return None
        wk = next((w for w in self.weeks if w.get("index") == week), None) or self.weeks[min(week, len(self.weeks)) - 1]
        day = next((d for d in wk.get("days", []) if d.get("weekday") == weekday), None)
        if day is not None and not day.get("time") and self.time:
            day = {**day, "time": self.time}
        return day


class WorkoutLog(models.Model):
    """One training session of an athlete (M36–M39, C23)."""

    class Status(models.TextChoices):
        PLANNED = "planned"
        IN_PROGRESS = "in-progress"
        COMPLETED = "completed"
        PARTIAL = "partial"
        MISSED = "missed"
        REST = "rest"

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="workouts")
    program = models.ForeignKey(Program, null=True, blank=True, on_delete=models.SET_NULL, related_name="logs")
    week = models.PositiveSmallIntegerField(null=True, blank=True)
    weekday = models.CharField(max_length=3, blank=True)
    focus = models.CharField(max_length=80, blank=True)
    # The day's session when it has several (morning gym, night run…): morning · noon · afternoon · night;
    # '' when the day is a single session. Each part is logged and finished on its own.
    part = models.CharField(max_length=10, blank=True, default="")
    date = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PLANNED)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_min = models.PositiveSmallIntegerField(null=True, blank=True)
    avg_hr = models.PositiveSmallIntegerField(null=True, blank=True)
    rpe = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)])
    # Cardio details the athlete enters (or the coach corrects) — running analytics (#44).
    distance_km = models.FloatField(null=True, blank=True, help_text="Total distance; falls back to the km/m sets.")
    max_hr = models.PositiveSmallIntegerField(null=True, blank=True)
    cadence_spm = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Average steps per minute.")
    elevation_m = models.PositiveIntegerField(null=True, blank=True, help_text="Total ascent.")
    # Read off the athlete's sports watch (Garmin / Polar / Coros…), never estimated by us.
    aerobic_te = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(5)], help_text="Aerobic Training Effect 0–5")
    anaerobic_te = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(5)], help_text="Anaerobic Training Effect 0–5")
    lt_hr = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Lactate-threshold heart rate (bpm) from the watch")
    lt_pace = models.FloatField(null=True, blank=True, help_text="Lactate-threshold pace (min/km) from the watch")
    athlete_note = models.TextField(blank=True)
    coach_feedback = models.JSONField(default=list, blank=True)
    feedback_at = models.DateTimeField(null=True, blank=True, help_text="When the coach last left feedback (the athlete is notified).")

    class Meta:
        ordering = ["-date"]
        # One session per program per day (#74: a running and a gym program can both train today).
        constraints = [models.UniqueConstraint(fields=["athlete", "date", "program", "part"], name="one_workout_per_program_day_part")]

    def __str__(self) -> str:
        return f"{self.athlete} {self.date}"

    @property
    def volume_kg(self) -> float:
        return sum((s.weight or 0) * (s.reps or 0) for s in self.sets.all() if s.done and s.unit == "kg")


class LoggedSet(models.Model):
    """A set as logged by the athlete. Targets are copied from the prescription; `actual_*` is filled
    only when the athlete did something different (tick = done as prescribed)."""

    log = models.ForeignKey(WorkoutLog, on_delete=models.CASCADE, related_name="sets")
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name="+")
    slot = models.PositiveSmallIntegerField(help_text="Position of the exercise in the day.")
    index = models.PositiveSmallIntegerField(help_text="Set number within the exercise (0-based).")
    target_reps = models.CharField(max_length=12, blank=True)
    target_value = models.FloatField(null=True, blank=True)
    unit = models.CharField(max_length=6, default="kg")
    actual_reps = models.CharField(max_length=12, blank=True)
    actual_value = models.FloatField(null=True, blank=True)
    done = models.BooleanField(default=False)
    is_pr = models.BooleanField(default=False)
    logged_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slot", "index"]
        constraints = [models.UniqueConstraint(fields=["log", "slot", "index"], name="unique_set_position")]

    @property
    def weight(self) -> float | None:
        return self.actual_value if self.actual_value is not None else self.target_value

    @property
    def reps(self) -> int | None:
        return first_int(self.actual_reps or self.target_reps)


class PersonalRecord(models.Model):
    """Best result for an exercise. `type` is e.g. `8RM` (heaviest load for ≥ 8 reps) or a test name."""

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="records")
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name="records")
    type = models.CharField(max_length=20)
    value = models.FloatField()
    unit = models.CharField(max_length=6, default="kg")
    date = models.DateField()
    previous = models.FloatField(null=True, blank=True)
    logged_set = models.OneToOneField(LoggedSet, null=True, blank=True, on_delete=models.SET_NULL, related_name="record")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self) -> str:
        return f"{self.exercise} {self.type} {self.value}{self.unit}"
