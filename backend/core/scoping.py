"""Row-level scoping for athlete data: a coach sees only their own athletes, an athlete only themself,
admins see none of it (training, nutrition, recovery and health data are never exposed to admin roles)."""

from rest_framework.exceptions import PermissionDenied, ValidationError

from .permissions import is_athlete, is_coach


class AthleteScopedMixin:
    """For viewsets whose model has an `athlete` FK (override `athlete_lookup` for other paths)."""

    athlete_lookup = "athlete"

    def scope(self, qs):
        user = self.request.user
        if is_coach(user):
            return qs.filter(**{f"{self.athlete_lookup}__coach": user.coach})
        if is_athlete(user):
            return qs.filter(**{self.athlete_lookup: user.athlete})
        return qs.none()

    def get_queryset(self):
        qs = self.scope(super().get_queryset())
        athlete = self.request.query_params.get("athlete")
        if athlete:
            if not athlete.isdigit():
                raise ValidationError({"athlete": "Invalid id."})
            qs = qs.filter(**{f"{self.athlete_lookup}_id": athlete})
        return qs

    def target_athlete(self, serializer):
        """Athlete a new row belongs to: the caller if an athlete, else the coach's validated `athlete`."""
        user = self.request.user
        if is_athlete(user):
            return user.athlete
        athlete = serializer.validated_data.get("athlete")
        if athlete is None:
            raise ValidationError({"athlete": "This field is required."})
        if not is_coach(user) or athlete.coach_id != user.coach.pk:
            raise PermissionDenied("Not your athlete.")
        return athlete
