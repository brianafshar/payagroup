from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from coaching.models import Athlete, Coach, TestDefinition


class NutritionPlan(models.Model):
    """Coach-set daily targets and meal plan for one athlete (C24 → M40)."""

    athlete = models.OneToOneField(Athlete, on_delete=models.CASCADE, primary_key=True, related_name="nutrition_plan")
    kcal = models.PositiveIntegerField(default=2000)
    protein = models.PositiveIntegerField(default=120, help_text="g")
    carbs = models.PositiveIntegerField(default=220, help_text="g")
    fat = models.PositiveIntegerField(default=65, help_text="g")
    water_l = models.FloatField(default=2.5)
    # Supplements the coach prescribes: [{"name", "dose", "timing"}] (e.g. کراتین · ۵ گرم · بعد از تمرین).
    supplements = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class NutritionTemplate(models.Model):
    """A reusable nutrition plan (targets, meals, supplements) shared by the whole gym, like program templates.
    `payload` is the plan in the API's shape without ids/totals; assigning copies it onto an athlete."""

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name="nutrition_templates")
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=200, blank=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Food(models.Model):
    """The food bank: shared Persian foods (owner empty, loaded from data/foods_fa.json) and each coach's
    own foods (visible to that coach only). Nutrition is per 100 g; units say how many grams one unit is."""

    owner = models.ForeignKey(Coach, null=True, blank=True, on_delete=models.CASCADE, related_name="foods")
    name = models.CharField(max_length=80)
    category = models.CharField(max_length=40, blank=True)
    kcal_per_100g = models.FloatField(validators=[MinValueValidator(0)])
    protein_per_100g = models.FloatField(default=0, validators=[MinValueValidator(0)])
    carbs_per_100g = models.FloatField(default=0, validators=[MinValueValidator(0)])
    fat_per_100g = models.FloatField(default=0, validators=[MinValueValidator(0)])
    default_unit = models.CharField(max_length=40, default="گرم")

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class FoodUnit(models.Model):
    food = models.ForeignKey(Food, on_delete=models.CASCADE, related_name="units")
    unit = models.CharField(max_length=40)
    grams = models.FloatField(validators=[MinValueValidator(0.01)])
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        constraints = [models.UniqueConstraint(fields=["food", "unit"], name="one_unit_name_per_food")]


def default_checks():
    return list(RecoveryPlan.CHECKS)


class RecoveryPlan(models.Model):
    """Coach-set recovery targets and the athlete's morning check-in questions (C25 → M41).
    Water is part of the nutrition plan (one target, shown on both screens)."""

    CHECKS = ["sleep", "quality", "energy", "stress", "soreness", "fatigue"]
    # Optional numbers from a sports watch (Garmin/Polar/Apple…), asked only when the coach enables them.
    WATCH = ["rhr", "hrv", "sleep_score", "body_battery", "spo2", "steps"]
    ALL_CHECKS = CHECKS + WATCH
    FIELD_KINDS = ["scale", "number", "yesno", "text"]

    athlete = models.OneToOneField(Athlete, on_delete=models.CASCADE, primary_key=True, related_name="recovery_plan")
    sleep_hours = models.FloatField(default=8, validators=[MinValueValidator(4), MaxValueValidator(12)])
    stretch_min = models.PositiveSmallIntegerField(default=15, validators=[MaxValueValidator(120)])
    rest_days = models.JSONField(default=list, blank=True, help_text="Weekday codes (sat…fri).")
    note = models.TextField(blank=True)
    checks = models.JSONField(default=default_checks, help_text="Check-in questions the athlete answers.")
    soreness_alert = models.PositiveSmallIntegerField(
        default=8, validators=[MinValueValidator(6), MaxValueValidator(10)], help_text="Flag soreness ≥ this two days running."
    )
    # Coach's own check-in questions (#53): [{"key", "label", "kind": scale|number|yesno|text, "unit"}].
    custom_fields = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Meal(models.Model):
    plan = models.ForeignKey(NutritionPlan, on_delete=models.CASCADE, related_name="meals")
    order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=60)
    time = models.TimeField(null=True, blank=True)
    # Weekday codes (sat … fri) this meal is served on; empty = every day (#47: a different menu per day).
    days = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def on(self, day: str) -> bool:
        return not self.days or day in self.days


class FoodItem(models.Model):
    """Totals are computed from per-100 g values × grams (the design's kcal-per-100g model)."""

    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name="foods")
    order = models.PositiveSmallIntegerField(default=0)
    name = models.CharField(max_length=80)
    # From the food bank: «۳ عدد» of a food. grams = quantity × the unit's grams and the per-100 g values are
    # copied from the food when saved, so totals below work the same for bank and hand-typed foods.
    food = models.ForeignKey(Food, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    unit = models.CharField(max_length=40, blank=True)
    quantity = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0)])
    grams = models.FloatField(validators=[MinValueValidator(0)])
    kcal_per_100g = models.FloatField(validators=[MinValueValidator(0)])
    protein_per_100g = models.FloatField(default=0, validators=[MinValueValidator(0)])
    carbs_per_100g = models.FloatField(default=0, validators=[MinValueValidator(0)])
    fat_per_100g = models.FloatField(default=0, validators=[MinValueValidator(0)])

    class Meta:
        ordering = ["order", "id"]

    def amount(self, per_100g: float) -> float:
        return round(per_100g * self.grams / 100, 1)


class MealLog(models.Model):
    """Athlete's adherence to a planned meal on a date: followed = 100 %, partial = 50 %, skipped = 0."""

    class Status(models.TextChoices):
        FOLLOWED = "followed"
        PARTIAL = "partial"
        SKIPPED = "skipped"

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="meal_logs")
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name="logs")
    date = models.DateField()
    status = models.CharField(max_length=8, choices=Status.choices)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date", "meal__order"]
        constraints = [models.UniqueConstraint(fields=["athlete", "meal", "date"], name="one_log_per_meal_per_day")]

    FACTOR = {"followed": 1.0, "partial": 0.5, "skipped": 0.0}


class WaterLog(models.Model):
    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="water_logs")
    date = models.DateField()
    liters = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(10)])

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["athlete", "date"], name="one_water_log_per_day")]


def scale():
    return [MinValueValidator(1), MaxValueValidator(10)]


class RecoveryCheckIn(models.Model):
    """Daily recovery check-in (M41 → C25/C30). 1–10 scales; empty = not recorded."""

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="recovery")
    date = models.DateField()
    sleep_hours = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(14)])
    sleep_quality = models.PositiveSmallIntegerField(null=True, blank=True, validators=scale())
    energy = models.PositiveSmallIntegerField(null=True, blank=True, validators=scale())
    stress = models.PositiveSmallIntegerField(null=True, blank=True, validators=scale())
    soreness = models.PositiveSmallIntegerField(null=True, blank=True, validators=scale())
    fatigue = models.PositiveSmallIntegerField(null=True, blank=True, validators=scale())
    resting_hr = models.PositiveSmallIntegerField(null=True, blank=True)
    # Optional watch metrics (#54): overnight HRV (rMSSD, ms), sleep score and Body Battery (0–100),
    # blood oxygen (%), yesterday's steps.
    hrv_ms = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(300)])
    sleep_score = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(100)])
    body_battery = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(100)])
    spo2 = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(70), MaxValueValidator(100)])
    steps = models.PositiveIntegerField(null=True, blank=True, validators=[MaxValueValidator(100000)])
    extra = models.JSONField(default=dict, blank=True, help_text="Answers to the coach's custom fields, by key.")
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["athlete", "date"], name="one_checkin_per_day")]


class Measurement(models.Model):
    """Body measurement. The athlete is the primary source; the coach can also record (M42, C29)."""

    class Metric(models.TextChoices):
        HEIGHT = "height"
        WEIGHT = "weight"
        BODY_FAT = "bodyFat"
        MUSCLE_MASS = "muscleMass"
        CHEST = "chest"
        WAIST = "waist"
        HIP = "hip"
        ARM = "arm"
        THIGH = "thigh"
        CALF = "calf"
        NECK = "neck"
        RESTING_HR = "restingHr"

    UNITS = {"height": "cm", "weight": "kg", "bodyFat": "%", "muscleMass": "kg", "restingHr": "bpm"}

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="measurements")
    metric = models.CharField(max_length=12, choices=Metric.choices)
    value = models.FloatField(validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=6, blank=True)
    date = models.DateField()
    recorded_by = models.CharField(max_length=7, choices=[("athlete", "athlete"), ("coach", "coach")])
    recorded_by_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def save(self, *args, **kwargs):
        if not self.unit:
            self.unit = self.UNITS.get(self.metric, "cm")
        super().save(*args, **kwargs)


class TestResult(models.Model):
    """Result of a coach-defined test (C28)."""

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="test_results")
    test = models.ForeignKey(TestDefinition, on_delete=models.CASCADE, related_name="results")
    value = models.FloatField()
    date = models.DateField()
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date", "-id"]
