from django.db import transaction
from rest_framework import serializers

from coaching.models import TestDefinition
from coaching.serializers import OwnAthleteField
from training.models import WEEKDAYS

from .models import Food, FoodItem, FoodUnit, Meal, MealLog, Measurement, NutritionPlan, RecoveryCheckIn, RecoveryPlan, TestResult, WaterLog

MACROS = ("kcal", "protein", "carbs", "fat")


class FoodUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodUnit
        fields = ["unit", "grams"]


def visible_foods(coach):
    """The shared bank plus the coach's own foods."""
    from django.db.models import Q

    return Food.objects.filter(Q(owner=None) | Q(owner=coach)) if coach else Food.objects.filter(owner=None)


class FoodSerializer(serializers.ModelSerializer):
    """A food in the bank. A coach's own food needs at least one unit; «گرم» is always added."""

    units = FoodUnitSerializer(many=True)
    mine = serializers.SerializerMethodField()

    class Meta:
        model = Food
        fields = ["id", "name", "category", "kcal_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "default_unit", "units", "mine"]

    def get_mine(self, f) -> bool:
        return f.owner_id is not None

    def validate_units(self, units):
        names = [u["unit"].strip() for u in units]
        if len(set(names)) != len(names):
            raise serializers.ValidationError("Each unit can appear once.")
        if "گرم" not in names:
            units = [*units, {"unit": "گرم", "grams": 1}]
        return units

    def validate(self, attrs):
        units = attrs.get("units")
        if units is not None:
            if not attrs.get("default_unit") or attrs["default_unit"] not in [u["unit"] for u in units]:
                attrs["default_unit"] = units[0]["unit"]
        return attrs

    @transaction.atomic
    def create(self, validated):
        units = validated.pop("units")
        food = Food.objects.create(**validated)
        FoodUnit.objects.bulk_create([FoodUnit(food=food, order=i, **u) for i, u in enumerate(units)])
        return food

    @transaction.atomic
    def update(self, food, validated):
        units = validated.pop("units", None)
        for k, v in validated.items():
            setattr(food, k, v)
        food.save()
        if units is not None:
            food.units.all().delete()
            FoodUnit.objects.bulk_create([FoodUnit(food=food, order=i, **u) for i, u in enumerate(units)])
        return food


class FoodItemSerializer(serializers.ModelSerializer):
    """A food in a meal: from the bank (`food` + `unit` + `quantity`; grams and macros are filled in here) or
    typed by hand (`name` + `grams` + per-100 g values)."""

    id = serializers.IntegerField(required=False)
    food = serializers.PrimaryKeyRelatedField(queryset=Food.objects.all(), required=False, allow_null=True)
    unit = serializers.CharField(max_length=40, required=False, allow_blank=True)
    quantity = serializers.FloatField(min_value=0, max_value=10000, required=False, allow_null=True)
    name = serializers.CharField(max_length=80, required=False)
    grams = serializers.FloatField(min_value=0, required=False)
    kcal_per_100g = serializers.FloatField(min_value=0, required=False)
    totals = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField(help_text="The food's units, for editing (bank foods only)")

    class Meta:
        model = FoodItem
        fields = ["id", "food", "unit", "quantity", "name", "grams", "kcal_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "totals", "units"]

    def get_totals(self, f) -> dict:
        return food_totals(f)

    def get_units(self, f) -> list:
        return FoodUnitSerializer(f.food.units.all(), many=True).data if f.food_id else []

    def validate(self, attrs):
        food = attrs.get("food")
        if food is None:
            attrs["food"], attrs["unit"], attrs["quantity"] = None, "", None
            missing = [k for k in ("name", "grams", "kcal_per_100g") if k not in attrs]
            if missing:
                raise serializers.ValidationError({k: "This field is required." for k in missing})
            return attrs
        coach = self.context.get("coach")
        if food.owner_id is not None and (coach is None or food.owner_id != coach.pk):
            raise serializers.ValidationError({"food": "Unknown food."})
        unit_name = attrs.get("unit") or food.default_unit
        unit = food.units.filter(unit=unit_name).first()
        if unit is None:
            raise serializers.ValidationError({"unit": f"«{unit_name}» is not a unit of {food.name}."})
        qty = attrs.get("quantity")
        if qty is None:
            raise serializers.ValidationError({"quantity": "This field is required."})
        attrs.update(
            unit=unit.unit,
            quantity=qty,
            grams=round(qty * unit.grams, 1),
            name=attrs.get("name") or food.name,
            kcal_per_100g=food.kcal_per_100g,
            protein_per_100g=food.protein_per_100g,
            carbs_per_100g=food.carbs_per_100g,
            fat_per_100g=food.fat_per_100g,
        )
        return attrs


class SupplementSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    dose = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    timing = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")


def food_totals(f) -> dict:
    return {"kcal": f.amount(f.kcal_per_100g), "protein": f.amount(f.protein_per_100g), "carbs": f.amount(f.carbs_per_100g), "fat": f.amount(f.fat_per_100g)}


def sum_totals(items) -> dict:
    out = dict.fromkeys(MACROS, 0.0)
    for t in items:
        for k in MACROS:
            out[k] += t[k]
    return {k: round(v, 1) for k, v in out.items()}


class MealSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    foods = FoodItemSerializer(many=True, default=list)
    days = serializers.ListField(child=serializers.ChoiceField(choices=WEEKDAYS), default=list, max_length=7, help_text="Empty = every day")
    totals = serializers.SerializerMethodField()

    class Meta:
        model = Meal
        fields = ["id", "name", "time", "days", "foods", "totals"]

    def validate_days(self, v: list) -> list:
        # Keep week order, drop repeats; all seven days is the same as "every day".
        days = [d for d in WEEKDAYS if d in v]
        return [] if len(days) == len(WEEKDAYS) else days

    def get_totals(self, meal) -> dict:
        return sum_totals(food_totals(f) for f in meal.foods.all())


class TargetsSerializer(serializers.Serializer):
    kcal = serializers.IntegerField(min_value=0, max_value=10000)
    protein = serializers.IntegerField(min_value=0, max_value=1000)
    carbs = serializers.IntegerField(min_value=0, max_value=2000)
    fat = serializers.IntegerField(min_value=0, max_value=1000)
    water_l = serializers.FloatField(min_value=0, max_value=10)


class NutritionPlanSerializer(serializers.ModelSerializer):
    """C24 plan: targets + meals of foods (kcal per 100 g × grams → totals). Saved whole; meals and foods
    keep their ids when sent back, so the athlete's meal logs survive plan edits."""

    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    targets = TargetsSerializer(source="*")
    meals = MealSerializer(many=True, default=list)
    supplements = SupplementSerializer(many=True, required=False, max_length=20)
    totals = serializers.SerializerMethodField(help_text="Average day of the week")
    day_totals = serializers.SerializerMethodField(help_text="Planned totals per weekday (sat … fri)")

    class Meta:
        model = NutritionPlan
        fields = ["athlete_id", "targets", "meals", "supplements", "totals", "day_totals", "updated_at"]
        read_only_fields = ["updated_at"]

    def get_day_totals(self, plan) -> dict:
        meals = [(m, [food_totals(f) for f in m.foods.all()]) for m in plan.meals.all()]
        return {d: sum_totals(t for m, fs in meals if m.on(d) for t in fs) for d in WEEKDAYS}

    def get_totals(self, plan) -> dict:
        days = self.get_day_totals(plan).values()
        return {k: round(sum(t[k] for t in days) / len(WEEKDAYS), 1) for k in MACROS}

    @transaction.atomic
    def save_plan(self, athlete) -> NutritionPlan:
        data = self.validated_data
        plan, _ = NutritionPlan.objects.get_or_create(athlete=athlete)
        for k in ("kcal", "protein", "carbs", "fat", "water_l"):
            setattr(plan, k, data[k])
        if "supplements" in data:
            plan.supplements = [dict(s) for s in data["supplements"]]
        plan.save()
        keep_meals = []
        for i, m in enumerate(data.get("meals", [])):
            meal = plan.meals.filter(pk=m.get("id")).first() if m.get("id") else None
            meal = meal or Meal(plan=plan)
            meal.order, meal.name, meal.time, meal.days = i, m["name"], m.get("time"), m.get("days", [])
            meal.save()
            keep_meals.append(meal.pk)
            keep_foods = []
            for j, f in enumerate(m.get("foods", [])):
                food = meal.foods.filter(pk=f.get("id")).first() if f.get("id") else None
                food = food or FoodItem(meal=meal)
                food.order = j
                for k in ("food", "unit", "quantity", "name", "grams", "kcal_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g"):
                    if k in f:
                        setattr(food, k, f[k])
                food.save()
                keep_foods.append(food.pk)
            meal.foods.exclude(pk__in=keep_foods).delete()
        plan.meals.exclude(pk__in=keep_meals).delete()
        self.instance = plan
        return plan


class MealLogSerializer(serializers.ModelSerializer):
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    meal_id = serializers.PrimaryKeyRelatedField(source="meal", queryset=Meal.objects.all())
    meal_name = serializers.CharField(source="meal.name", read_only=True)

    class Meta:
        model = MealLog
        fields = ["id", "athlete_id", "meal_id", "meal_name", "date", "status", "note"]


class WaterLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterLog
        fields = ["date", "liters"]


class CustomFieldSerializer(serializers.Serializer):
    """A coach-defined check-in question (#53)."""

    key = serializers.RegexField(r"^[a-z][a-z0-9_]{0,30}$", help_text="Stable id for the answers, e.g. `c_mood`.")
    label = serializers.CharField(max_length=60)
    kind = serializers.ChoiceField(choices=RecoveryPlan.FIELD_KINDS, default="scale")
    unit = serializers.CharField(max_length=16, required=False, allow_blank=True, default="")


class RecoveryPlanSerializer(serializers.ModelSerializer):
    """C25 recovery plan. `waterL` is the nutrition plan's water target (shared with C24)."""

    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    water_l = serializers.FloatField(min_value=0, max_value=10, required=False)
    rest_days = serializers.ListField(child=serializers.ChoiceField(choices=WEEKDAYS), max_length=7, required=False)
    checks = serializers.ListField(child=serializers.ChoiceField(choices=RecoveryPlan.ALL_CHECKS), max_length=len(RecoveryPlan.ALL_CHECKS), required=False)
    custom_fields = CustomFieldSerializer(many=True, required=False, max_length=12)

    class Meta:
        model = RecoveryPlan
        fields = ["athlete_id", "sleep_hours", "water_l", "stretch_min", "rest_days", "note", "checks", "custom_fields", "soreness_alert", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate_custom_fields(self, fields):
        keys = [f["key"] for f in fields]
        if len(keys) != len(set(keys)):
            raise serializers.ValidationError("Field keys must be unique.")
        return fields

    def to_representation(self, plan):
        data = super().to_representation(plan)
        nutrition = NutritionPlan.objects.filter(athlete=plan.athlete).first()
        data["water_l"] = nutrition.water_l if nutrition else 2.5
        return data

    @transaction.atomic
    def update(self, plan, validated):
        water = validated.pop("water_l", None)
        if water is not None:
            nutrition, _ = NutritionPlan.objects.get_or_create(athlete=plan.athlete)
            nutrition.water_l = water
            nutrition.save(update_fields=["water_l", "updated_at"])
        return super().update(plan, validated)


class RecoveryCheckInSerializer(serializers.ModelSerializer):
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)

    class Meta:
        model = RecoveryCheckIn
        fields = [
            "id", "athlete_id", "date", "sleep_hours", "sleep_quality", "energy", "stress", "soreness", "fatigue", "resting_hr",
            "hrv_ms", "sleep_score", "body_battery", "spo2", "steps", "extra", "note", "updated_at",
        ]  # fmt: skip
        read_only_fields = ["updated_at"]

    def validate_extra(self, extra):
        """Answers to custom fields: short scalars only (number, yes/no or up to 200 characters)."""
        if not isinstance(extra, dict) or len(extra) > 20:
            raise serializers.ValidationError("Expected up to 20 answers keyed by field.")
        for k, v in extra.items():
            ok = v is None or isinstance(v, bool) or isinstance(v, (int, float)) or (isinstance(v, str) and len(v) <= 200)
            if not (isinstance(k, str) and len(k) <= 32 and ok):
                raise serializers.ValidationError(f"Invalid answer for {k!r}.")
        return extra


class MeasurementSerializer(serializers.ModelSerializer):
    athlete = OwnAthleteField(write_only=True, required=False)
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)

    class Meta:
        model = Measurement
        fields = ["id", "athlete", "athlete_id", "metric", "value", "unit", "date", "recorded_by", "created_at"]
        read_only_fields = ["recorded_by", "created_at"]
        extra_kwargs = {"unit": {"required": False}}


class MeasurementBatchSerializer(serializers.Serializer):
    """M42: several metrics recorded at once for one date."""

    class Value(serializers.Serializer):
        metric = serializers.ChoiceField(choices=Measurement.Metric.choices)
        value = serializers.FloatField(min_value=0)

    athlete = OwnAthleteField(required=False)
    date = serializers.DateField()
    values = Value(many=True, allow_empty=False, max_length=len(Measurement.Metric.values))

    def validate_values(self, values):
        metrics = [v["metric"] for v in values]
        if len(metrics) != len(set(metrics)):
            raise serializers.ValidationError("Each metric once per entry.")
        return values


class TestResultSerializer(serializers.ModelSerializer):
    athlete = OwnAthleteField(write_only=True, required=False)
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    athlete_name = serializers.CharField(source="athlete.name", read_only=True)
    test_id = serializers.PrimaryKeyRelatedField(source="test", queryset=TestDefinition.objects.all())
    test_name = serializers.CharField(source="test.name", read_only=True)
    unit = serializers.CharField(source="test.unit", read_only=True)
    better = serializers.CharField(source="test.better", read_only=True)

    class Meta:
        model = TestResult
        fields = ["id", "athlete", "athlete_id", "athlete_name", "test_id", "test_name", "unit", "better", "value", "date", "note"]

    def validate_test_id(self, test):
        user = self.context["request"].user
        if user.role != "coach" or test.coach_id not in user.coach.gym_ids():
            raise serializers.ValidationError("Unknown test.")
        return test
