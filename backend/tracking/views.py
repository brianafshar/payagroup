from datetime import date

from django.db import transaction
from django.db.models import Value
from django.db.models.functions import Replace
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from coaching.models import Athlete
from core.permissions import CoachWritesAthleteReads, IsAthlete, IsCoach, IsCoachOrAthlete, is_athlete, is_coach
from core.scoping import AthleteScopedMixin
from training.models import PY_WEEKDAY

from .models import Food, MealLog, Measurement, NutritionPlan, RecoveryCheckIn, RecoveryPlan, TestResult, WaterLog
from .serializers import (
    FoodSerializer,
    MealLogSerializer,
    MeasurementBatchSerializer,
    MeasurementSerializer,
    NutritionPlanSerializer,
    RecoveryCheckInSerializer,
    RecoveryPlanSerializer,
    TestResultSerializer,
    WaterLogSerializer,
    food_totals,
    sum_totals,
    visible_foods,
)

DATE_RANGE = [OpenApiParameter("athlete", int), OpenApiParameter("from", str), OpenApiParameter("to", str)]


def parse_date(value: str | None, field: str = "date") -> date:
    if not value:
        return timezone.localdate()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({field: "Use YYYY-MM-DD."}) from None


class DateRangeMixin:
    date_field = "date"

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("from"):
            qs = qs.filter(**{f"{self.date_field}__gte": parse_date(p["from"], "from")})
        if p.get("to"):
            qs = qs.filter(**{f"{self.date_field}__lte": parse_date(p["to"], "to")})
        return qs


# ---------------------------------------------------------------- food bank


def normalize_fa(text: str) -> str:
    """Arabic ي/ك → Persian ی/ک and no zero-width joiner, so «سفيده» finds «سفیده»."""
    return text.replace("ي", "ی").replace("ك", "ک").replace("\u200c", "").strip()


@extend_schema(parameters=[OpenApiParameter("q", str, description="Search by name"), OpenApiParameter("category", str)])
class FoodViewSet(viewsets.ModelViewSet):
    """The food bank for nutrition plans: the shared Persian foods plus the coach's own. `?q=` searches by
    name (names starting with the query first). A coach adds, edits and deletes only their own foods."""

    serializer_class = FoodSerializer
    permission_classes = [IsCoach]
    pagination_class = None
    LIMIT = 40

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Food.objects.none()
        coach = self.request.user.coach
        qs = visible_foods(coach).prefetch_related("units")
        if self.action not in ("list", "retrieve"):
            return qs.filter(owner=coach)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if request.query_params.get("category"):
            qs = qs.filter(category=request.query_params["category"])
        q = normalize_fa(request.query_params.get("q", ""))
        if q:
            # Compare on names with the zero-width joiner removed, e.g. «تخممرغ» and «تخم‌مرغ».
            qs = qs.annotate(flat=Replace("name", Value("\u200c"), Value(""))).filter(flat__icontains=q)
            rows = sorted(qs, key=lambda f: (not f.flat.startswith(q), len(f.name), f.name))[: self.LIMIT]
        else:
            rows = list(qs[: self.LIMIT])
        return Response(self.get_serializer(rows, many=True).data)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user.coach)


# ---------------------------------------------------------------- nutrition


class NutritionPlanView(APIView):
    """C24: the athlete's plan. Coach reads and replaces it; the athlete reads their own (`me`)."""

    permission_classes = [IsCoachOrAthlete]

    def athlete(self, request, athlete_id) -> Athlete:
        if athlete_id == "me":
            if not is_athlete(request.user):
                raise PermissionDenied()
            return request.user.athlete
        if not is_coach(request.user):
            raise PermissionDenied()
        return get_object_or_404(Athlete, pk=athlete_id, coach__in=request.user.coach.athlete_scope_ids())

    @extend_schema(responses=NutritionPlanSerializer)
    def get(self, request, athlete_id):
        plan, _ = NutritionPlan.objects.get_or_create(athlete=self.athlete(request, athlete_id))
        plan = NutritionPlan.objects.prefetch_related("meals__foods__food__units").get(pk=plan.pk)
        return Response(NutritionPlanSerializer(plan).data)

    @extend_schema(request=NutritionPlanSerializer, responses=NutritionPlanSerializer)
    def put(self, request, athlete_id):
        athlete = self.athlete(request, athlete_id)
        if not is_coach(request.user):
            raise PermissionDenied()
        s = NutritionPlanSerializer(data=request.data, context={"coach": request.user.coach})
        s.is_valid(raise_exception=True)
        return Response(NutritionPlanSerializer(s.save_plan(athlete)).data)


class RecoveryPlanView(NutritionPlanView):
    """C25: the athlete's recovery plan. Coach reads and edits it; the athlete reads their own (`me`)."""

    @extend_schema(responses=RecoveryPlanSerializer)
    def get(self, request, athlete_id):
        plan, _ = RecoveryPlan.objects.get_or_create(athlete=self.athlete(request, athlete_id))
        return Response(RecoveryPlanSerializer(plan).data)

    @extend_schema(request=RecoveryPlanSerializer, responses=RecoveryPlanSerializer)
    def put(self, request, athlete_id):
        athlete = self.athlete(request, athlete_id)
        if not is_coach(request.user):
            raise PermissionDenied()
        plan, _ = RecoveryPlan.objects.get_or_create(athlete=athlete)
        s = RecoveryPlanSerializer(plan, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        return Response(RecoveryPlanSerializer(s.save()).data)


class NutritionDayView(APIView):
    """M40: the athlete's plan for a day with meal statuses, eaten totals and water.
    Totals count followed meals 100 %, partial 50 %, skipped/unlogged 0."""

    permission_classes = [IsAthlete]

    @extend_schema(parameters=[OpenApiParameter("date", str)], responses={200: dict})
    def get(self, request):
        athlete = request.user.athlete
        day = parse_date(request.query_params.get("date"))
        plan, _ = NutritionPlan.objects.get_or_create(athlete=athlete)
        plan_data = NutritionPlanSerializer(plan).data
        logs = {m.meal_id: m for m in MealLog.objects.filter(athlete=athlete, date=day)}
        meals, eaten = [], []
        weekday = PY_WEEKDAY[day.weekday()]
        for meal in plan.meals.prefetch_related("foods"):
            if not meal.on(weekday) and meal.pk not in logs:
                continue  # not on today's menu
            log = logs.get(meal.pk)
            totals = sum_totals(food_totals(f) for f in meal.foods.all())
            factor = MealLog.FACTOR[log.status] if log else 0.0
            eaten.append({k: v * factor for k, v in totals.items()})
            meals.append({"id": meal.pk, "name": meal.name, "time": meal.time, "totals": totals, "status": log.status if log else "unlogged"})
        water = WaterLog.objects.filter(athlete=athlete, date=day).first()
        return Response({"date": day, "targets": plan_data["targets"], "meals": meals, "eaten": sum_totals(eaten), "water_l": water.liters if water else 0.0})


class MealLogViewSet(AthleteScopedMixin, DateRangeMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Meal adherence. Athlete: create = upsert (meal, date). Coach: read."""

    serializer_class = MealLogSerializer
    permission_classes = [IsCoachOrAthlete]
    queryset = MealLog.objects.select_related("meal", "athlete")

    def create(self, request):
        if not is_athlete(request.user):
            raise PermissionDenied()
        s = MealLogSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        meal = s.validated_data["meal"]
        if meal.plan.athlete_id != request.user.athlete.pk:
            raise ValidationError({"meal_id": "Unknown meal."})
        log, _ = MealLog.objects.update_or_create(
            athlete=request.user.athlete,
            meal=meal,
            date=s.validated_data["date"],
            defaults={"status": s.validated_data["status"], "note": s.validated_data.get("note", "")},
        )
        return Response(MealLogSerializer(log).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        if not is_athlete(self.request.user):
            raise PermissionDenied()
        instance.delete()


class WaterLogViewSet(AthleteScopedMixin, DateRangeMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Water intake by day (athlete: own; coach: their athletes). Athletes write through `me/water/`."""

    serializer_class = WaterLogSerializer
    permission_classes = [IsCoachOrAthlete]
    queryset = WaterLog.objects.all()


class WaterView(APIView):
    """Athlete's water intake for a date (upsert)."""

    permission_classes = [IsAthlete]

    @extend_schema(request=WaterLogSerializer, responses=WaterLogSerializer)
    def put(self, request):
        s = WaterLogSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        log, _ = WaterLog.objects.update_or_create(athlete=request.user.athlete, date=s.validated_data["date"], defaults={"liters": s.validated_data["liters"]})
        return Response(WaterLogSerializer(log).data)


# ---------------------------------------------------------------- recovery, measurements, tests


@extend_schema(parameters=DATE_RANGE)
class RecoveryCheckInViewSet(AthleteScopedMixin, DateRangeMixin, viewsets.ModelViewSet):
    """M41 check-ins (one per day; POST on an existing date updates it). Coach reads (C25, C30)."""

    serializer_class = RecoveryCheckInSerializer
    permission_classes = [IsCoachOrAthlete]
    queryset = RecoveryCheckIn.objects.all()
    http_method_names = ["get", "post", "patch", "delete"]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in ("GET", "HEAD", "OPTIONS") and not is_athlete(request.user):
            raise PermissionDenied("Check-ins are recorded by the athlete.")

    def create(self, request):
        s = RecoveryCheckInSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        day = data.pop("date")
        obj, created = RecoveryCheckIn.objects.update_or_create(athlete=request.user.athlete, date=day, defaults=data)
        return Response(RecoveryCheckInSerializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@extend_schema(parameters=[*DATE_RANGE, OpenApiParameter("metric", str)])
class MeasurementViewSet(AthleteScopedMixin, DateRangeMixin, viewsets.ModelViewSet):
    """Body measurements (M42, C29). The athlete records their own; the coach can record for their athletes.
    Only the side that recorded a value can change or delete it."""

    serializer_class = MeasurementSerializer
    permission_classes = [IsCoachOrAthlete]
    queryset = Measurement.objects.all()
    filterset_fields = ["metric", "recorded_by"]
    ordering_fields = ["date", "created_at"]

    def role(self) -> str:
        return "athlete" if is_athlete(self.request.user) else "coach"

    def perform_create(self, serializer):
        serializer.save(athlete=self.target_athlete(serializer), recorded_by=self.role(), recorded_by_user=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.recorded_by != self.role():
            raise PermissionDenied("Recorded by the other side.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.recorded_by != self.role():
            raise PermissionDenied("Recorded by the other side.")
        instance.delete()

    @extend_schema(request=MeasurementBatchSerializer, responses=MeasurementSerializer(many=True))
    @action(detail=False, methods=["post"])
    def batch(self, request):
        """Record several metrics for one date (the M42 form)."""
        s = MeasurementBatchSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        athlete = self.target_athlete(s)
        with transaction.atomic():
            rows = [
                Measurement.objects.create(
                    athlete=athlete, metric=v["metric"], value=v["value"], date=s.validated_data["date"], recorded_by=self.role(), recorded_by_user=request.user
                )
                for v in s.validated_data["values"]
            ]
        return Response(MeasurementSerializer(rows, many=True).data, status=status.HTTP_201_CREATED)

    @extend_schema(parameters=[OpenApiParameter("athlete", int)], responses={200: dict})
    @action(detail=False, methods=["get"])
    def latest(self, request):
        """Latest value per metric with the previous one (for change arrows). Missing metrics are absent."""
        out: dict = {}
        for m in self.get_queryset().order_by("metric", "-date", "-id"):
            if m.metric not in out:
                out[m.metric] = {"metric": m.metric, "value": m.value, "unit": m.unit, "date": m.date, "previous": None}
            elif out[m.metric]["previous"] is None:
                out[m.metric]["previous"] = m.value
        return Response(list(out.values()))


@extend_schema(parameters=[*DATE_RANGE, OpenApiParameter("test", int)])
class TestResultViewSet(AthleteScopedMixin, DateRangeMixin, viewsets.ModelViewSet):
    """Results of coach-defined tests (C28). Coach records; athlete reads."""

    serializer_class = TestResultSerializer
    permission_classes = [CoachWritesAthleteReads]
    queryset = TestResult.objects.select_related("test", "athlete")
    filterset_fields = ["test"]

    def perform_create(self, serializer):
        serializer.save(athlete=self.target_athlete(serializer))
