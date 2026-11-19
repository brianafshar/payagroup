"""Role checks. Roles live on `User.role` (admin / coach / athlete); admins also have `admin_role`."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import PlatformSettings


def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and user.role == "admin")


def is_coach(user) -> bool:
    return bool(user and user.is_authenticated and user.role == "coach" and hasattr(user, "coach"))


def is_athlete(user) -> bool:
    return bool(user and user.is_authenticated and user.role == "athlete" and hasattr(user, "athlete"))


def admin_can(user, key: str) -> bool:
    return is_admin(user) and PlatformSettings.load().allows(user.admin_role, key)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)


class IsCoach(BasePermission):
    def has_permission(self, request, view):
        return is_coach(request.user)


class IsAthlete(BasePermission):
    def has_permission(self, request, view):
        return is_athlete(request.user)


class IsCoachOrAthlete(BasePermission):
    def has_permission(self, request, view):
        return is_coach(request.user) or is_athlete(request.user)


class CoachWritesAthleteReads(BasePermission):
    """Coach: full access (querysets are scoped to their athletes). Athlete: read-only."""

    def has_permission(self, request, view):
        if is_coach(request.user):
            return True
        return is_athlete(request.user) and request.method in SAFE_METHODS


def AdminPerm(key: str, read_key: str | None = None):
    """Admin permission from the A08 matrix. `read_key` lets any admin with that key read (e.g. lists)."""

    class _AdminPerm(BasePermission):
        def has_permission(self, request, view):
            if not is_admin(request.user):
                return False
            if request.method in SAFE_METHODS and read_key:
                return admin_can(request.user, read_key) or admin_can(request.user, key)
            return admin_can(request.user, key)

    _AdminPerm.__name__ = f"AdminPerm_{key}"
    return _AdminPerm


def AdminAnyPerm(*keys: str):
    """Admin holding at least one of the keys (the view checks field-level rights itself)."""

    class _AdminAnyPerm(BasePermission):
        def has_permission(self, request, view):
            return any(admin_can(request.user, k) for k in keys)

    _AdminAnyPerm.__name__ = f"AdminAnyPerm_{'_'.join(keys)}"
    return _AdminAnyPerm
