import os

from django.conf import settings
from django.db.models import Count, Max, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from coaching.models import Athlete
from core.permissions import IsCoach, IsCoachOrAthlete, is_athlete
from core.uploads import AUDIO_EXTS

from . import push, realtime
from .models import Device, Message, preview

MAX_VOICE_SEC = 300  # 5 minutes


class MessageSerializer(serializers.ModelSerializer):
    athlete_id = serializers.IntegerField(source="athlete.pk", read_only=True)
    # Coaches pass `athlete`; athletes always write to their own thread.
    athlete = serializers.IntegerField(write_only=True, required=False)
    status = serializers.SerializerMethodField()
    deleted = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "athlete", "athlete_id", "sender", "text", "attachment", "voice_sec", "ref", "created_at", "read_at", "status", "edited_at", "deleted"]
        read_only_fields = ["sender", "created_at", "read_at", "edited_at"]

    def get_deleted(self, m) -> bool:
        return m.deleted_at is not None

    def get_status(self, m) -> str:
        return "read" if m.read_at else "sent"

    voice_sec = serializers.FloatField(min_value=0.5, max_value=MAX_VOICE_SEC, required=False, allow_null=True)

    def validate(self, attrs):
        if attrs.get("voice_sec") is not None:
            f = attrs.get("attachment")
            if not f:
                raise ValidationError({"attachment": "Attach the recording."})
            if os.path.splitext(f.name)[1].lower() not in AUDIO_EXTS:
                raise ValidationError({"attachment": "A voice message must be an audio file."})
        # A message can be just a file, or just a reference card (e.g. today's session).
        if not attrs.get("text", "").strip() and not attrs.get("attachment") and not attrs.get("ref", "").strip():
            raise ValidationError({"text": "Write a message or attach a file."})
        return attrs


class MessageEditSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=4000)


@extend_schema(
    parameters=[
        OpenApiParameter("athlete", int, description="Required for coaches."),
        OpenApiParameter("after", int, description="Only messages newer than this id (polling)."),
        OpenApiParameter("before", int, description="Only messages older than this id (history)."),
    ]
)
class MessageViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Coach ↔ athlete chat (C33, M47). One thread per athlete. New messages and read receipts are also
    pushed live over the `/ws/` WebSocket; `?after=<last id>` catches up after a reconnect. The athlete's
    phone gets a push notification for coach messages. The sender can edit a message's text
    (`PATCH messages/{id}/`) or delete it for both sides (`DELETE messages/{id}/`); both are pushed live
    as an `update` event."""

    serializer_class = MessageSerializer
    permission_classes = [IsCoachOrAthlete]
    pagination_class = None
    PAGE = 50

    def thread(self, athlete_id=None) -> Athlete:
        user = self.request.user
        if is_athlete(user):
            return user.athlete
        athlete_id = athlete_id or self.request.query_params.get("athlete")
        if not athlete_id or not str(athlete_id).isdigit():
            raise ValidationError({"athlete": "This field is required."})
        return get_object_or_404(Athlete, pk=athlete_id, coach=user.coach)

    def sender(self) -> str:
        return "athlete" if is_athlete(self.request.user) else "coach"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Message.objects.none()
        qs = Message.objects.filter(athlete=self.thread())
        p = self.request.query_params
        if p.get("after", "").isdigit():
            return qs.filter(pk__gt=p["after"])[: self.PAGE]
        if p.get("before", "").isdigit():
            qs = qs.filter(pk__lt=p["before"])
        # Latest page, oldest first.
        ids = list(qs.order_by("-created_at", "-id").values_list("pk", flat=True)[: self.PAGE])
        return Message.objects.filter(pk__in=ids)

    def perform_create(self, serializer):
        athlete = self.thread(serializer.validated_data.pop("athlete", None))
        msg = serializer.save(athlete=athlete, sender=self.sender(), sender_user=self.request.user)
        realtime.send_to_users(realtime.thread_users(athlete), {"type": "chat.message", "message": dict(serializer.data)})
        if msg.sender == "coach" and not athlete.coach.in_quiet_hours():
            body = msg.preview
            push.notify([athlete.user_id], athlete.coach.user.name, body, {"type": "message", "athleteId": athlete.pk, "messageId": msg.pk})

    def own_message(self, pk) -> Message:
        """A message in the caller's thread that the caller sent (only the sender edits or deletes)."""
        user = self.request.user
        qs = Message.objects.filter(athlete__user=user) if is_athlete(user) else Message.objects.filter(athlete__coach=user.coach)
        msg = get_object_or_404(qs, pk=pk)
        if msg.sender != self.sender():
            raise PermissionDenied("Only the sender can change a message.")
        if msg.deleted_at:
            raise ValidationError({"detail": "This message was deleted."})
        return msg

    def broadcast_update(self, msg: Message) -> dict:
        data = dict(MessageSerializer(msg, context=self.get_serializer_context()).data)
        realtime.send_to_users(realtime.thread_users(msg.athlete), {"type": "chat.update", "message": data})
        return data

    @extend_schema(request=MessageEditSerializer, responses=MessageSerializer)
    def partial_update(self, request, pk=None):
        msg = self.own_message(pk)
        s = MessageEditSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        text = s.validated_data["text"].strip()
        if not text and not msg.attachment and not msg.ref:
            raise ValidationError({"text": "Write a message or delete it."})
        msg.text, msg.edited_at = text, timezone.now()
        msg.save(update_fields=["text", "edited_at"])
        return Response(self.broadcast_update(msg))

    @extend_schema(request=None, responses=MessageSerializer)
    def destroy(self, request, pk=None):
        msg = self.own_message(pk)
        msg.soft_delete()
        return Response(self.broadcast_update(msg))

    @extend_schema(request=None, responses={200: dict})
    @action(detail=False, methods=["post"])
    def read(self, request):
        """Mark the other side's messages in the thread as read."""
        other = "coach" if self.sender() == "athlete" else "athlete"
        athlete = self.thread(request.data.get("athlete"))
        now = timezone.now()
        n = Message.objects.filter(athlete=athlete, sender=other, read_at=None).update(read_at=now)
        if n:
            realtime.send_to_users(
                realtime.thread_users(athlete), {"type": "chat.read", "athlete_id": athlete.pk, "reader": self.sender(), "at": now.isoformat()}
            )
        return Response({"updated": n})


class ThreadListView(APIView):
    """C33 inbox: the coach's athletes with their last message and unread count, most recent first."""

    permission_classes = [IsCoach]

    @extend_schema(responses={200: dict})
    def get(self, request):
        last = Message.objects.filter(athlete=OuterRef("pk")).order_by("-created_at", "-id")
        rows = (
            Athlete.objects.filter(coach=request.user.coach)
            .annotate(
                last_at=Max("messages__created_at"),
                unread=Count("messages", filter=Q(messages__sender="athlete", messages__read_at=None)),
                last_text=Subquery(last.values("text")[:1]),
                last_sender=Subquery(last.values("sender")[:1]),
                last_deleted=Subquery(last.values("deleted_at")[:1]),
                last_voice=Subquery(last.values("voice_sec")[:1]),
                last_file=Subquery(last.values("attachment")[:1]),
            )
            .filter(last_at__isnull=False)
            .order_by("-last_at")
        )
        return Response(
            [
                {
                    "athlete_id": a.pk,
                    "name": a.name,
                    "last_at": a.last_at,
                    "last_text": preview(a.last_text, a.last_voice, a.last_file or "", a.last_deleted is not None),
                    "last_sender": a.last_sender,
                    "unread": a.unread,
                }
                for a in rows
            ]
        )


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ["token", "platform"]
        extra_kwargs = {"token": {"validators": []}}

    def validate(self, attrs):
        if not push.token_ok(attrs["token"], attrs["platform"]):
            if attrs["platform"] == "web":
                raise ValidationError({"token": "Expected a Web Push subscription."})
            raise ValidationError({"token": "Expected an Expo push token." if push.backend() == "expo" else "Invalid push token."})
        return attrs


class PushConfigView(APIView):
    """What the clients need to subscribe: the Web Push (VAPID) public key, or null when Web Push is off."""

    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response({"web_push_key": settings.WEBPUSH_PUBLIC_KEY if push.webpush_enabled() else None})


class DeviceView(APIView):
    """Register this install for push notifications (after sign-in) or unregister it (before sign-out).
    A token moves to whoever signed in last on that device."""

    @extend_schema(request=DeviceSerializer, responses=DeviceSerializer)
    def post(self, request):
        s = DeviceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        sid = request.auth.get("sid") if request.auth is not None else None
        Device.objects.update_or_create(
            token=s.validated_data["token"], defaults={"user": request.user, "platform": s.validated_data["platform"], "session_id": sid}
        )
        return Response(s.data, status=201)

    @extend_schema(request=DeviceSerializer, responses={204: None})
    def delete(self, request):
        Device.objects.filter(user=request.user, token=request.data.get("token", "")).delete()
        return Response(status=204)
