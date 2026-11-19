from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import BrandingSerializer

from . import stats
from .models import AccountStatus, Athlete, AthleteNote, Coach, CoachDocument, HealthProfile, TestDefinition


class TestDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestDefinition
        fields = ["id", "name", "category", "unit", "better", "protocol"]


def validity(coach: Coach) -> dict:
    if coach.validity_days is None:
        return {"kind": "unlimited"}
    return {"kind": "limited", "days": coach.validity_days, "expires_at": coach.expires_at}


def cadence(coach: Coach) -> dict:
    return {"kind": coach.cadence, "weeks": coach.cadence_weeks} if coach.cadence == "every-n-weeks" else {"kind": coach.cadence}


class CoachSerializer(serializers.ModelSerializer):
    """Coach workspace as the admin panel sees it (web `Coach` type). Branding is written as flat fields."""

    name = serializers.CharField(source="user.name")
    email = serializers.EmailField(source="user.email")
    user_id = serializers.IntegerField(source="user.pk", read_only=True)
    status = serializers.CharField(source="effective_status", read_only=True)
    branding = serializers.SerializerMethodField()
    validity = serializers.SerializerMethodField()
    days_left = serializers.IntegerField(read_only=True)
    cadence = serializers.SerializerMethodField()
    custom_tests = TestDefinitionSerializer(source="tests", many=True, read_only=True)
    athlete_count = serializers.IntegerField(read_only=True)
    last_login_at = serializers.DateTimeField(source="user.last_login", read_only=True)
    has_account = serializers.SerializerMethodField(help_text="False while the coach hasn't set a password (invite not accepted).")
    remove_logo = serializers.BooleanField(write_only=True, required=False, help_text="Back to the initials logo.")

    class Meta:
        model = Coach
        fields = [
            "id", "user_id", "name", "email", "status", "is_head", "branding", "sport", "athlete_cap", "athlete_count", "validity",
            "days_left", "reminder_days", "cadence", "custom_tests", "last_login_at", "has_account", "created_at",
            # write-only branding fields
            "app_name", "initials", "primary", "secondary", "theme", "logo", "remove_logo",
        ]  # fmt: skip
        read_only_fields = ["created_at"]
        extra_kwargs = {k: {"write_only": True} for k in ["app_name", "initials", "primary", "secondary", "theme", "logo"]}

    def get_branding(self, coach) -> dict:
        return BrandingSerializer(coach, context=self.context).data

    def get_has_account(self, coach) -> bool:
        return not coach.user.pending

    def get_validity(self, coach) -> dict:
        return validity(coach)

    def get_cadence(self, coach) -> dict:
        return cadence(coach)

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise serializers.ValidationError("Email already in use.", code="conflict")
        return value

    def update(self, coach, validated):
        if validated.pop("remove_logo", False) and coach.logo:
            coach.logo.delete(save=False)
            coach.logo = ""
        user_data = validated.pop("user", {})
        for k, v in user_data.items():
            setattr(coach.user, k, v)
        if user_data:
            coach.user.save()
        return super().update(coach, validated)


class CoachCreateSerializer(serializers.Serializer):
    """A04 Create coach. `durationDays: null` = unlimited; validity starts when the coach activates."""

    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    app_name = serializers.CharField(max_length=60)
    sport = serializers.CharField(max_length=40, default="fitness")
    athlete_cap = serializers.IntegerField(min_value=1, allow_null=True, default=None)
    duration_days = serializers.IntegerField(min_value=1, max_value=1095, allow_null=True, default=None)
    reminder_days = serializers.ChoiceField(choices=[1, 2, 3, 7], default=2)
    primary = serializers.RegexField(r"^#[0-9A-Fa-f]{6}$", default="#FF9A1F")
    send_invite = serializers.BooleanField(default=True)

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("Email already in use.", code="conflict")
        return value.lower()

    def validate_phone(self, value):
        digits = value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")).replace(" ", "")
        if digits and not (len(digits) == 11 and digits.startswith("09") and digits.isdigit()):
            raise serializers.ValidationError("Use the 09xxxxxxxxx format.")
        return digits

    @transaction.atomic
    def create(self, data):
        from training import library

        user = User.objects.create_user(data["email"], name=data["name"], role=User.Role.COACH, phone=data["phone"])
        coach = Coach.objects.create(
            user=user,
            app_name=data["app_name"],
            sport=data["sport"],
            athlete_cap=data["athlete_cap"],
            validity_days=data["duration_days"],
            reminder_days=data["reminder_days"],
            primary=data["primary"],
            status=AccountStatus.INVITED if data["send_invite"] else AccountStatus.DRAFT,
        )
        library.install(coach)  # every new coach starts with the standard exercise library (#39)
        return coach


class CoachProfileSerializer(serializers.ModelSerializer):
    """The coach's own settings (C32). Branding, cap and validity are managed by admins (read-only here)."""

    name = serializers.CharField(source="user.name")
    email = serializers.EmailField(source="user.email", read_only=True)
    status = serializers.CharField(source="effective_status", read_only=True)
    branding = serializers.SerializerMethodField()
    validity = serializers.SerializerMethodField()
    days_left = serializers.IntegerField(read_only=True)
    custom_tests = TestDefinitionSerializer(source="tests", many=True, read_only=True)
    athlete_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Coach
        fields = [
            "id",
            "name",
            "email",
            "status",
            "sport",
            "bio",
            "is_head",
            "branding",
            "athlete_cap",
            "athlete_count",
            "validity",
            "days_left",
            "reminder_days",
            "cadence",
            "cadence_weeks",
            "quiet_hours",
            "preferences",
            "custom_tests",
        ]
        read_only_fields = ["athlete_cap", "reminder_days", "is_head"]

    def get_branding(self, coach) -> dict:
        return BrandingSerializer(coach, context=self.context).data

    def get_validity(self, coach) -> dict:
        return validity(coach)

    def validate_preferences(self, value):
        import json

        if not isinstance(value, dict) or len(json.dumps(value)) > 20_000:
            raise serializers.ValidationError("Expected a JSON object (max 20 KB).")
        return value

    def validate(self, attrs):
        kind = attrs.get("cadence", getattr(self.instance, "cadence", None))
        weeks = attrs.get("cadence_weeks", getattr(self.instance, "cadence_weeks", None))
        if kind == "every-n-weeks" and not weeks:
            raise serializers.ValidationError({"cadence_weeks": "Required for every-n-weeks."})
        return attrs

    def update(self, coach, validated):
        user_data = validated.pop("user", {})
        if user_data:
            coach.user.name = user_data["name"]
            coach.user.save(update_fields=["name"])
        return super().update(coach, validated)


class MeasureScheduleSerializer(serializers.Serializer):
    """When the athlete measures (C29): frequency, weekday, reminder and required metrics."""

    freq = serializers.ChoiceField(choices=["w1", "w2", "w3", "m1", "custom"])
    n = serializers.IntegerField(min_value=2, max_value=12, default=6)
    day = serializers.ChoiceField(choices=["sa", "su", "mo", "tu", "we", "th", "fr"])
    remind = serializers.ChoiceField(choices=["eve", "morning", "both", "off"], default="morning")
    req = serializers.ListField(child=serializers.ChoiceField(choices=["w", "f", "m", "ch", "wa", "ar", "th", "hi", "ca", "ne"]), default=list)


class AthleteSerializer(serializers.ModelSerializer):
    """Athlete (web `Athlete` type). Health is a separate endpoint and is never included here."""

    coach_id = serializers.IntegerField(source="coach.pk", read_only=True)
    coach_name = serializers.CharField(source="coach.user.name", read_only=True)
    user_id = serializers.IntegerField(source="user.pk", read_only=True, default=None)
    program_id = serializers.IntegerField(source="program.pk", read_only=True, default=None)
    program_name = serializers.CharField(source="program.name", read_only=True, default=None)
    program_week = serializers.IntegerField(read_only=True)
    customized = serializers.SerializerMethodField()
    height_cm = serializers.FloatField(read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Athlete
        fields = [
            "id", "coach_id", "coach_name", "user_id", "name", "email", "phone", "status", "goal", "gender", "birth_date",
            "sport", "height_cm", "program_id", "program_name", "program_week", "customized", "stats", "last_active_at", "created_at",
            "goal_weight_kg", "measure_schedule", "max_hr", "key_lifts",
        ]  # fmt: skip
        read_only_fields = ["status", "last_active_at", "created_at"]

    key_lifts = serializers.ListField(child=serializers.IntegerField(), max_length=6, required=False)

    def validate_key_lifts(self, value):
        """Key lifts for the strength analytics: the coach's own kg exercises, in the coach's order."""
        from training.models import Exercise

        ids = list(dict.fromkeys(value))
        user = self.context["request"].user
        coach = user.coach if getattr(user, "role", "") == "coach" else None
        ok = set(Exercise.objects.filter(pk__in=ids, coach__in=coach.gym_ids(), unit="kg").values_list("pk", flat=True)) if coach else set()
        if set(ids) - ok:
            raise serializers.ValidationError("Unknown exercise.")
        return ids

    def get_customized(self, a) -> bool:
        return bool(a.program and a.program.kind == "customized")

    def get_stats(self, a) -> dict:
        return stats.athlete_stats(a)

    def validate_email(self, value):
        return value.lower()

    def validate_measure_schedule(self, value):
        if value is None:
            return None
        s = MeasureScheduleSerializer(data=value)
        s.is_valid(raise_exception=True)
        return s.validated_data

    def validate_phone(self, value):
        digits = value.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")).replace(" ", "")
        if digits and not (len(digits) == 11 and digits.startswith("09") and digits.isdigit()):
            raise serializers.ValidationError("Use the 09xxxxxxxxx format.")
        return digits


class InviteModeField(serializers.ChoiceField):
    """`"email"` · `"link"` · `false`/`"none"` (save as draft)."""

    def __init__(self, **kwargs):
        super().__init__(choices=["email", "link", "none"], **kwargs)

    def to_internal_value(self, data):
        return "none" if data in (False, None, "") else super().to_internal_value(data)


class AthleteCreateSerializer(AthleteSerializer):
    """C13 Add athlete. `invite`: `email` sends the invite · `link` returns it for copying · `false` saves a draft."""

    invite = InviteModeField(default="none", write_only=True)

    class Meta(AthleteSerializer.Meta):
        fields = [*AthleteSerializer.Meta.fields, "invite"]

    def validate(self, attrs):
        if attrs.get("invite") != "none" and not attrs.get("email"):
            raise serializers.ValidationError({"email": "Email is required to invite."})
        if attrs.get("email") and User.objects.filter(email=attrs["email"]).exclude(role="athlete").exists():
            raise serializers.ValidationError({"email": "Email already in use."}, code="conflict")
        return attrs


class HealthProfileSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source="updated_by.name", read_only=True, default=None)

    class Meta:
        model = HealthProfile
        fields = ["conditions", "injuries", "medications", "allergies", "limitations", "history", "note", "updated_at", "updated_by_name"]
        read_only_fields = ["updated_at"]


@extend_schema_field(OpenApiTypes.INT)
class OwnAthleteField(serializers.PrimaryKeyRelatedField):
    """`athlete` id restricted to the requesting coach's athletes (athletes can only target themselves)."""

    def get_queryset(self):
        user = self.context["request"].user
        if user.role == "coach" and hasattr(user, "coach"):
            return Athlete.objects.filter(coach__in=user.coach.athlete_scope_ids())
        if user.role == "athlete" and hasattr(user, "athlete"):
            return Athlete.objects.filter(pk=user.athlete.pk)
        return Athlete.objects.none()


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AthleteNote
        fields = ["id", "text", "created_at"]


class CoachDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoachDocument
        fields = ["id", "kind", "file", "name", "size", "created_at"]
        read_only_fields = ["name", "size", "created_at"]
