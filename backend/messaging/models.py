import os

from django.conf import settings
from django.db import models
from django.utils import timezone

from coaching.models import Athlete, Coach
from core.uploads import attachment_upload_to, validate_attachment


class Message(models.Model):
    """Coach ↔ athlete chat (C33, M47). There is one thread per athlete, so the athlete is the thread."""

    class Sender(models.TextChoices):
        COACH = "coach"
        ATHLETE = "athlete"

    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=7, choices=Sender.choices)
    sender_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    text = models.TextField(blank=True)
    attachment = models.FileField(upload_to=attachment_upload_to, blank=True, validators=[validate_attachment])
    # Set for a voice message: the attachment is the recording and this is its length in seconds.
    voice_sec = models.FloatField(null=True, blank=True)
    # Optional link to an app object, e.g. "workout:42" or "program:7".
    ref = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    # The sender may edit the text or delete the message for both sides; a deleted message keeps its place
    # in the thread as «این پیام حذف شد» (text, file and reference are removed).
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def soft_delete(self) -> None:
        if self.attachment:
            self.attachment.delete(save=False)
        self.text, self.ref, self.attachment, self.voice_sec, self.deleted_at = "", "", None, None, timezone.now()
        self.save(update_fields=["text", "ref", "attachment", "voice_sec", "deleted_at"])

    @property
    def preview(self) -> str:
        """One line for notifications and the inbox."""
        return preview(self.text, self.voice_sec, self.attachment.name if self.attachment else "", self.deleted_at is not None)


def preview(text: str, voice_sec: float | None, attachment: str = "", deleted: bool = False) -> str:
    """`attachment` is the file name (or path); its type picks the label when there's no text."""
    from core.uploads import RASTER_EXTS, VIDEO_EXTS

    if deleted:
        return "پیام حذف شد"
    if voice_sec is not None:
        s = round(voice_sec)
        return "🎤 پیام صوتی " + f"{s // 60}:{s % 60:02d}".translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    if text or not attachment:
        return text
    ext = os.path.splitext(str(attachment))[1].lower()
    return "🎬 ویدیو" if ext in VIDEO_EXTS else "📷 عکس" if ext in RASTER_EXTS else "📎 فایل پیوست"


class ChatGroup(models.Model):
    """A coach's broadcast group (#81): the coach posts, the member athletes only read."""

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name="chat_groups")
    name = models.CharField(max_length=120)
    members = models.ManyToManyField(Athlete, through="GroupMember", related_name="chat_groups")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return self.name


class GroupMember(models.Model):
    group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE, related_name="memberships")
    athlete = models.ForeignKey(Athlete, on_delete=models.CASCADE, related_name="group_memberships")
    joined_at = models.DateTimeField(auto_now_add=True)
    # Up to when the athlete has read the group; later messages count as unread.
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["group", "athlete"], name="one_membership_per_group")]


class GroupMessage(models.Model):
    """A post in a group. Only the coach writes; they can edit the text or delete it for everyone."""

    group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE, related_name="messages")
    text = models.TextField(blank=True)
    attachment = models.FileField(upload_to=attachment_upload_to, blank=True, validators=[validate_attachment])
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def soft_delete(self) -> None:
        if self.attachment:
            self.attachment.delete(save=False)
        self.text, self.attachment, self.deleted_at = "", None, timezone.now()
        self.save(update_fields=["text", "attachment", "deleted_at"])

    @property
    def preview(self) -> str:
        return preview(self.text, None, self.attachment.name if self.attachment else "", self.deleted_at is not None)


class Device(models.Model):
    """A signed-in app install that receives push notifications: an Expo token or Pushe device id (phones),
    or a Web Push subscription as JSON (browsers and iPhone home-screen apps)."""

    class Platform(models.TextChoices):
        IOS = "ios"
        ANDROID = "android"
        WEB = "web"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="devices")
    # The sign-in it was registered under: ending that session stops its notifications.
    session = models.ForeignKey("accounts.LoginSession", null=True, blank=True, on_delete=models.CASCADE, related_name="push_devices")
    token = models.CharField(max_length=1024, unique=True)
    platform = models.CharField(max_length=8, choices=Platform.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
