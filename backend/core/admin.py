from django.contrib import admin

from .models import AuditEvent, PlatformSettings


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ["at", "actor", "action", "target_type", "target_id"]
    list_filter = ["action", "target_type"]
    readonly_fields = [f.name for f in AuditEvent._meta.fields]


admin.site.register(PlatformSettings)
