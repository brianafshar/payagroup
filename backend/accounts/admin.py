from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Invite, ResetToken, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["username"]
    list_display = ["username", "name", "role", "admin_role", "is_active", "last_login"]
    list_filter = ["role", "admin_role", "is_active"]
    search_fields = ["username", "email", "name"]
    fieldsets = [
        (None, {"fields": ["username", "email", "password"]}),
        ("Profile", {"fields": ["name", "phone", "photo", "theme"]}),
        ("Access", {"fields": ["role", "admin_role", "two_factor", "force_password_change", "session_epoch", "is_active", "is_staff", "is_superuser"]}),
        ("Dates", {"fields": ["last_login", "date_joined"]}),
    ]
    add_fieldsets = [(None, {"classes": ["wide"], "fields": ["username", "name", "role", "password1", "password2"]})]


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ["email", "kind", "created_at", "expires_at", "used_at"]
    list_filter = ["kind"]
    readonly_fields = ["token_hash"]


@admin.register(ResetToken)
class ResetTokenAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at", "expires_at", "used_at"]
    readonly_fields = ["token_hash"]
