from django.contrib import admin

from .models import Athlete, Coach, TestDefinition


@admin.register(Coach)
class CoachAdmin(admin.ModelAdmin):
    list_display = ["app_name", "user", "status", "athlete_cap", "expires_at"]
    list_filter = ["status", "sport"]
    search_fields = ["app_name", "user__name", "user__email"]


@admin.register(Athlete)
class AthleteAdmin(admin.ModelAdmin):
    """Health profiles are intentionally not registered: admins never see health data."""

    list_display = ["name", "coach", "status", "email"]
    list_filter = ["status", "coach"]
    search_fields = ["name", "email"]


admin.site.register(TestDefinition)
