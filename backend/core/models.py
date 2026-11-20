from django.conf import settings
from django.db import models

# Admin permission keys (A08 › نقش‌ها و مجوزها). Values: [super admin, support admin].
# Health data, programs and logging are locked for admin roles and are not part of the matrix.
ADMIN_PERMISSIONS = {
    "cm": "ایجاد، فعال‌سازی و غیرفعال‌سازی مربیان",
    "br": "پیکربندی برندینگ مربی",
    "ath": "مدیریت حساب ورزشکاران",
    "rep": "مشاهده گزارش‌ها و آمار پلتفرم",
    "audit": "مشاهده گزارش رویدادها",
    "adm": "مدیریت کاربران مدیر",
}
DEFAULT_PERMISSIONS = {"cm": [True, False], "br": [True, True], "ath": [True, True], "rep": [True, True], "audit": [True, False], "adm": [True, False]}


def default_permissions() -> dict:
    return {k: list(v) for k, v in DEFAULT_PERMISSIONS.items()}


class PlatformSettings(models.Model):
    """Singleton (pk=1): admin permission matrix and security policy (A08)."""

    permissions = models.JSONField(default=default_permissions)
    require_admin_2fa = models.BooleanField(default=True)
    require_coach_2fa = models.BooleanField(default=False)
    # Admin sessions end this long after sign-in, however active (refresh stops working).
    session_timeout_minutes = models.PositiveIntegerField(default=480)
    # Audit events older than this are deleted by `daily_jobs`.
    audit_retention_days = models.PositiveIntegerField(default=730)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = verbose_name_plural = "platform settings"

    @classmethod
    def load(cls) -> "PlatformSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def allows(self, admin_role: str, key: str) -> bool:
        row = {**DEFAULT_PERMISSIONS, **(self.permissions or {})}.get(key)
        if not row:
            return False
        return bool(row[0] if admin_role == "super" else row[1])


class AuditEvent(models.Model):
    """Security-relevant actions: password changes, reset/invite links, expiry changes, health access."""

    at = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_events")
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=32, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-at"]

    def __str__(self) -> str:
        return f"{self.at:%Y-%m-%d %H:%M} {self.action}"


def audit(actor, action: str, target=None, **meta) -> AuditEvent:
    return AuditEvent.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        target_type=target._meta.model_name if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        meta=meta,
    )


class SectionUsage(models.Model):
    """Time a user spent in one section of the panel or the app on one day (seconds the page was visible
    and the user active), reported by the clients in small batches. For the admin's activity analytics:
    which sections people use, so the right ones get improved."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="section_usage")
    date = models.DateField()
    section = models.CharField(max_length=40)
    seconds = models.PositiveIntegerField(default=0)
    visits = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "date", "section"], name="one_usage_row_per_day")]
        indexes = [models.Index(fields=["date", "section"])]


DEFAULT_ACCOUNT_SMS = "{name} عزیز، حساب شما در {brand} ساخته شد. به‌زودی برنامه تمرینی شما برایتان ارسال می‌شود."
DEFAULT_PROGRAM_SMS = "{name} عزیز، برنامه تمرینی جدید به شما اختصاص داده شد.\nدانلود برنامه:\n{link}\n{brand}"


class SmsSettings(models.Model):
    """Singleton (pk=1): Kavenegar credentials and the two SMS texts, edited by the head coach in the app.
    Falls back to the KAVENEGAR_* environment variables when the key is left empty."""

    api_key = models.CharField(max_length=200, blank=True)
    sender = models.CharField(max_length=32, blank=True)
    account_text = models.TextField(default=DEFAULT_ACCOUNT_SMS)
    program_text = models.TextField(default=DEFAULT_PROGRAM_SMS)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = verbose_name_plural = "SMS settings"

    @classmethod
    def load(cls) -> "SmsSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
