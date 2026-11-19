from django.core.files.storage import default_storage
from rest_framework import serializers

from coaching.serializers import OwnAthleteField

from .models import WEEKDAYS, Exercise, LoggedSet, PersonalRecord, Program, WorkoutLog


class ExerciseSerializer(serializers.ModelSerializer):
    """Library exercise (web `Exercise` type: short keys `cat`, `equip`, `diff`, `dur`)."""

    cat = serializers.CharField(source="category", max_length=30)
    equip = serializers.CharField(source="equipment", max_length=30)
    diff = serializers.ChoiceField(source="difficulty", choices=Exercise.Difficulty.choices, required=False)
    dur = serializers.CharField(source="duration", max_length=8, required=False, allow_blank=True)
    has_video = serializers.SerializerMethodField()
    video_src = serializers.SerializerMethodField()
    used = serializers.IntegerField(read_only=True, default=0)
    metrics = serializers.ListField(child=serializers.CharField(max_length=40), required=False)
    cues = serializers.ListField(child=serializers.CharField(max_length=200), required=False)
    remove_video = serializers.BooleanField(write_only=True, required=False)
    image_src = serializers.SerializerMethodField()
    has_own_image = serializers.SerializerMethodField(help_text="True when the coach uploaded the picture (vs the library one).")
    remove_image = serializers.BooleanField(write_only=True, required=False)
    steps = serializers.ListField(child=serializers.CharField(max_length=300), required=False, max_length=12)
    muscles_primary = serializers.ListField(child=serializers.CharField(max_length=40), required=False)
    muscles_secondary = serializers.ListField(child=serializers.CharField(max_length=40), required=False)
    issues = serializers.ListField(child=serializers.CharField(max_length=40), required=False)
    image_start_src = serializers.SerializerMethodField(help_text="Start pose of the library illustration (the end pose is `imageSrc`).")
    alternatives = serializers.SerializerMethodField(help_text="{band, home, replaces}: ids of this coach's exercises.")

    class Meta:
        model = Exercise
        fields = [
            "id",
            "name",
            "cat",
            "equip",
            "diff",
            "has_video",
            "video_src",
            "video",
            "video_url",
            "dur",
            "metrics",
            "used",
            "sport",
            "measure",
            "unit",
            "description",
            "cues",
            "remove_video",
            "image",
            "image_src",
            "has_own_image",
            "remove_image",
            "steps",
            "muscles_primary",
            "muscles_secondary",
            "issues",
            "badge",
            "illustration_match",
            "library_key",
            "image_start_src",
            "alternatives",
            "updated_at",
        ]
        read_only_fields = ["updated_at", "badge", "illustration_match", "library_key"]
        extra_kwargs = {"video": {"write_only": True, "required": False}, "image": {"write_only": True, "required": False}}

    def update(self, ex, validated):
        if validated.pop("remove_video", False):
            if ex.video:
                ex.video.delete(save=False)
            ex.video, ex.video_url, ex.duration = "", "", ""
        if validated.pop("remove_image", False):
            # First removal drops the coach's own picture (back to the library illustration); with none,
            # it hides the library picture too. The shared library file stays in storage for others.
            if ex.image:
                ex.image.delete(save=False)
                ex.image = ""
            else:
                ex.stock_image = ""
        return super().update(ex, validated)

    def create(self, validated):
        validated.pop("remove_video", None)
        validated.pop("remove_image", None)
        return super().create(validated)

    def get_image_src(self, ex) -> str | None:
        if ex.image:
            url = ex.image.url
        elif ex.stock_image:
            url = default_storage.url(ex.stock_image)
        else:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_image_start_src(self, ex) -> str | None:
        if ex.image or not ex.stock_image_start:
            return None
        url = default_storage.url(ex.stock_image_start)
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_alternatives(self, ex) -> dict:
        """Library keys → ids of the same coach's exercises (looked up once per response)."""
        if not ex.alternatives:
            return {}
        cache = self.context.setdefault("_library_ids", {})
        if ex.coach_id not in cache:
            cache[ex.coach_id] = dict(Exercise.objects.filter(coach_id=ex.coach_id).exclude(library_key="").values_list("library_key", "id"))
        ids = cache[ex.coach_id]
        out = {k: [str(ids[x]) for x in keys if x in ids] for k, keys in ex.alternatives.items()}
        return {k: v for k, v in out.items() if v}

    def get_has_own_image(self, ex) -> bool:
        return bool(ex.image)

    def get_has_video(self, ex) -> bool:
        return bool(ex.video or ex.video_url)

    def get_video_src(self, ex) -> str | None:
        if ex.video:
            request = self.context.get("request")
            return request.build_absolute_uri(ex.video.url) if request else ex.video.url
        return ex.video_url or None


class SetPrescriptionSerializer(serializers.Serializer):
    reps = serializers.CharField(max_length=12)
    value = serializers.FloatField(allow_null=True, required=False, min_value=0)
    unit = serializers.CharField(max_length=6, default="kg")
    rest_sec = serializers.IntegerField(allow_null=True, required=False, min_value=0, max_value=3600)
    rpe = serializers.FloatField(allow_null=True, required=False, min_value=1, max_value=10)


class ExerciseSlotSerializer(serializers.Serializer):
    id = serializers.CharField(max_length=40, required=False, allow_blank=True)
    exercise_id = serializers.IntegerField()
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)
    # A day can have several sessions (morning gym, evening run…): each exercise's part of the day;
    # empty = the day's (or the program's) time.
    time = serializers.ChoiceField(choices=["", "morning", "noon", "afternoon", "night"], required=False, default="")
    sets = SetPrescriptionSerializer(many=True, max_length=20)


class ProgramDaySerializer(serializers.Serializer):
    weekday = serializers.ChoiceField(choices=WEEKDAYS)
    focus = serializers.CharField(max_length=80, required=False, allow_blank=True)
    # Part of the day the session is meant for (#PDF day-by-day): morning · noon · afternoon · night, or none.
    time = serializers.ChoiceField(choices=["", "morning", "noon", "afternoon", "night"], required=False, default="")
    rest = serializers.BooleanField(default=False)
    exercises = ExerciseSlotSerializer(many=True, max_length=30, default=list)


class ProgramWeekSerializer(serializers.Serializer):
    index = serializers.IntegerField(min_value=1, max_value=52)
    days = ProgramDaySerializer(many=True, max_length=7)

    def validate_days(self, days):
        names = [d["weekday"] for d in days]
        if len(names) != len(set(names)):
            raise serializers.ValidationError("Each weekday may appear once per week.")
        return sorted(days, key=lambda d: WEEKDAYS.index(d["weekday"]))


class ProgramSerializer(serializers.ModelSerializer):
    """Program with its week/day/exercise/set tree (the builder saves it whole)."""

    coach_id = serializers.IntegerField(source="coach.pk", read_only=True)
    template_id = serializers.IntegerField(source="template.pk", read_only=True, default=None)
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True, default=None)
    athlete_name = serializers.CharField(source="athlete.name", read_only=True, default=None)
    assigned_count = serializers.IntegerField(read_only=True, default=None)
    main = serializers.SerializerMethodField(help_text="The athlete's main program (#74).")
    weeks = ProgramWeekSerializer(many=True, required=False)
    time = serializers.ChoiceField(choices=["", "morning", "noon", "afternoon", "night"], required=False, allow_blank=True)

    class Meta:
        model = Program
        fields = [
            "id",
            "coach_id",
            "name",
            "goal",
            "sport",
            "time",
            "description",
            "kind",
            "template_id",
            "athlete_id",
            "athlete_name",
            "version",
            "duration_weeks",
            "sessions_per_week",
            "assigned_count",
            "archived",
            "active",
            "start_date",
            "main",
            "weeks",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["kind", "version", "active", "start_date", "created_at", "updated_at"]

    def get_main(self, p) -> bool:
        return bool(p.athlete_id and p.athlete.program_id == p.pk)

    def validate_weeks(self, weeks):
        indexes = [w["index"] for w in weeks]
        if len(indexes) != len(set(indexes)):
            raise serializers.ValidationError("Week indexes must be unique.")
        ids = {ex["exercise_id"] for w in weeks for d in w["days"] for ex in d["exercises"]}
        coach = self.context["request"].user.coach
        known = set(Exercise.objects.filter(coach=coach, pk__in=ids).values_list("pk", flat=True))
        if ids - known:
            raise serializers.ValidationError(f"Unknown exercises: {sorted(ids - known)}")
        return sorted(weeks, key=lambda w: w["index"])

    def validate(self, attrs):
        weeks = attrs.get("weeks")
        duration = attrs.get("duration_weeks", getattr(self.instance, "duration_weeks", 4))
        if weeks and max(w["index"] for w in weeks) > duration:
            raise serializers.ValidationError({"weeks": "A week index exceeds durationWeeks."})
        return attrs

    def create(self, validated):
        weeks = _plain(validated.pop("weeks", []))
        program = Program.objects.create(weeks=weeks, **validated)
        program.sync_exercises()
        return program

    def update(self, program, validated):
        """Saving a template bumps its version (athlete copies keep theirs); editing an athlete's copy
        marks it customized."""
        weeks = validated.pop("weeks", None)
        for k, v in validated.items():
            setattr(program, k, v)
        if weeks is not None:
            program.weeks = _plain(weeks)
        if program.kind == Program.Kind.TEMPLATE:
            program.version += 1
        elif weeks is not None:
            program.kind = Program.Kind.CUSTOMIZED
        program.save()
        if weeks is not None:
            program.sync_exercises()
        return program


def _plain(value):
    """Validated nested data → plain JSON (dicts/lists) for the `weeks` JSONField."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


class ProgramListSerializer(ProgramSerializer):
    exercise_count = serializers.IntegerField(read_only=True, default=0, help_text="0 = nothing planned yet (a draft).")

    class Meta(ProgramSerializer.Meta):
        fields = [f for f in ProgramSerializer.Meta.fields if f not in ("weeks", "description")] + ["exercise_count"]


class AssignSerializer(serializers.Serializer):
    athlete_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=200)
    start_date = serializers.DateField(required=False)
    replace = serializers.BooleanField(default=True, help_text="False: runs alongside the athlete's other programs (#74).")


class ActivateSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    replace = serializers.BooleanField(default=True)


class LoggedSetSerializer(serializers.ModelSerializer):
    exercise_id = serializers.IntegerField(read_only=True)
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)

    class Meta:
        model = LoggedSet
        fields = [
            "id",
            "slot",
            "index",
            "exercise_id",
            "exercise_name",
            "target_reps",
            "target_value",
            "unit",
            "actual_reps",
            "actual_value",
            "done",
            "is_pr",
            "logged_at",
        ]
        read_only_fields = ["slot", "index", "target_reps", "target_value", "unit", "is_pr", "logged_at"]


class WorkoutLogSerializer(serializers.ModelSerializer):
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    athlete_name = serializers.CharField(source="athlete.name", read_only=True)
    program_id = serializers.IntegerField(source="program.pk", read_only=True, default=None)
    sets = LoggedSetSerializer(many=True, read_only=True)
    volume_kg = serializers.FloatField(read_only=True)

    class Meta:
        model = WorkoutLog
        fields = [
            "id",
            "athlete_id",
            "athlete_name",
            "program_id",
            "week",
            "weekday",
            "focus",
            "part",
            "date",
            "status",
            "started_at",
            "finished_at",
            "duration_min",
            "avg_hr",
            "rpe",
            "distance_km",
            "max_hr",
            "cadence_spm",
            "elevation_m",
            "aerobic_te",
            "anaerobic_te",
            "lt_hr",
            "lt_pace",
            "athlete_note",
            "coach_feedback",
            "feedback_at",
            "volume_kg",
            "sets",
        ]
        read_only_fields = fields


class FinishSerializer(serializers.Serializer):
    rpe = serializers.IntegerField(min_value=1, max_value=10, required=False, allow_null=True)
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    duration_min = serializers.IntegerField(min_value=1, max_value=600, required=False, allow_null=True)
    avg_hr = serializers.IntegerField(min_value=30, max_value=230, required=False, allow_null=True)
    distance_km = serializers.FloatField(min_value=0, max_value=500, required=False, allow_null=True)
    max_hr = serializers.IntegerField(min_value=60, max_value=240, required=False, allow_null=True)
    cadence_spm = serializers.IntegerField(min_value=60, max_value=260, required=False, allow_null=True)
    elevation_m = serializers.IntegerField(min_value=0, max_value=10000, required=False, allow_null=True)
    aerobic_te = serializers.FloatField(min_value=0, max_value=5, required=False, allow_null=True)
    anaerobic_te = serializers.FloatField(min_value=0, max_value=5, required=False, allow_null=True)
    lt_hr = serializers.IntegerField(min_value=80, max_value=230, required=False, allow_null=True)
    lt_pace = serializers.FloatField(min_value=2, max_value=15, required=False, allow_null=True)


class SessionMetricsSerializer(FinishSerializer):
    """Correcting a logged session later (athlete or their coach): only the fields sent change."""

    note = None


class FeedbackSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=1000)


class PersonalRecordSerializer(serializers.ModelSerializer):
    athlete = OwnAthleteField(write_only=True, required=False)
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    exercise_id = serializers.PrimaryKeyRelatedField(source="exercise", queryset=Exercise.objects.all())
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    athlete_name = serializers.CharField(source="athlete.name", read_only=True)
    auto = serializers.SerializerMethodField()

    class Meta:
        model = PersonalRecord
        fields = ["id", "athlete", "athlete_id", "athlete_name", "exercise_id", "exercise_name", "type", "value", "unit", "date", "previous", "auto"]

    def get_auto(self, pr) -> bool:
        return pr.logged_set_id is not None

    def validate_exercise_id(self, ex):
        user = self.context["request"].user
        if user.role != "coach" or ex.coach_id != user.coach.pk:
            raise serializers.ValidationError("Unknown exercise.")
        return ex
