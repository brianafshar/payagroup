"""Coach broadcast groups (#81). A coach makes a group from their own athletes and posts to it; members
read in the app and can't reply. New posts, edits and membership changes go out live over the `/ws/`
WebSocket as a `group` event, and members' phones get a push notification for each post."""

from datetime import UTC, datetime

from django.db.models import Count, Max, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from coaching.models import Athlete
from core.permissions import IsCoachOrAthlete, is_athlete

from . import push, realtime
from .models import ChatGroup, GroupMember, GroupMessage, preview

NEVER = datetime(2000, 1, 1, tzinfo=UTC)


class GroupMessageSerializer(serializers.ModelSerializer):
    group_id = serializers.IntegerField(source="group.pk", read_only=True)
    deleted = serializers.SerializerMethodField()

    class Meta:
        model = GroupMessage
        fields = ["id", "group_id", "text", "attachment", "created_at", "edited_at", "deleted"]
        read_only_fields = ["created_at", "edited_at"]

    def get_deleted(self, m) -> bool:
        return m.deleted_at is not None

    def validate(self, attrs):
        if not attrs.get("text", "").strip() and not attrs.get("attachment"):
            raise ValidationError({"text": "Write a message or attach a file."})
        return attrs


class ChatGroupSerializer(serializers.ModelSerializer):
    # Coaches see and set the members; athletes only see how many there are.
    members = serializers.PrimaryKeyRelatedField(many=True, queryset=Athlete.objects.none(), required=False)
    member_count = serializers.SerializerMethodField()
    last_text = serializers.SerializerMethodField()
    last_at = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()
    coach_name = serializers.CharField(source="coach.user.name", read_only=True)

    class Meta:
        model = ChatGroup
        fields = ["id", "name", "members", "member_count", "coach_name", "created_at", "last_text", "last_at", "unread"]
        read_only_fields = ["created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = self.context["request"].user if "request" in self.context else None
        if user is not None and hasattr(user, "coach"):
            self.fields["members"].child_relation.queryset = Athlete.objects.filter(coach=user.coach)
        elif user is not None:
            self.fields.pop("members")

    def validate_name(self, v: str) -> str:
        if not v.strip():
            raise ValidationError("Name the group.")
        return v.strip()

    def get_member_count(self, g) -> int:
        return g.n_members if hasattr(g, "n_members") else g.memberships.count()

    def get_last_text(self, g) -> str:
        if getattr(g, "last_id", None) is None:
            return ""
        return preview(g.last_txt or "", None, g.last_file or "", g.last_deleted is not None)

    def get_last_at(self, g):
        return getattr(g, "last_created", None)

    def get_unread(self, g) -> int:
        return getattr(g, "n_unread", 0) or 0


@extend_schema(parameters=[OpenApiParameter("before", int, description="messages/: only posts older than this id (history).")])
class ChatGroupViewSet(viewsets.ModelViewSet):
    """Coach: create, rename, set members of and delete groups; post, edit and delete messages.
    Athlete: list their groups (with unread counts), read the messages, mark a group read."""

    serializer_class = ChatGroupSerializer
    permission_classes = [IsCoachOrAthlete]
    pagination_class = None
    PAGE = 50

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ChatGroup.objects.none()
        user = self.request.user
        last = GroupMessage.objects.filter(group=OuterRef("pk")).order_by("-created_at", "-id")
        qs = ChatGroup.objects.select_related("coach__user").annotate(
            n_members=Count("memberships", distinct=True),
            last_id=Subquery(last.values("id")[:1]),
            last_txt=Subquery(last.values("text")[:1]),
            last_file=Subquery(last.values("attachment")[:1]),
            last_deleted=Subquery(last.values("deleted_at")[:1]),
            last_created=Max("messages__created_at"),
        )
        if is_athlete(user):
            mine = GroupMember.objects.filter(group=OuterRef("pk"), athlete=user.athlete)
            # Never opened → everything is unread.
            qs = qs.filter(memberships__athlete=user.athlete).annotate(read_at=Coalesce(Subquery(mine.values("read_at")[:1]), Value(NEVER)))
            # Unread = posts after the athlete last opened the group.
            unread = (
                GroupMessage.objects.filter(group=OuterRef("pk"), deleted_at=None)
                .filter(created_at__gt=OuterRef("read_at"))
                .order_by()
                .values("group")
                .annotate(n=Count("pk"))
                .values("n")
            )
            qs = qs.annotate(n_unread=Subquery(unread[:1]))
        else:
            qs = qs.filter(coach=user.coach)
        return qs.order_by("-last_created", "-created_at")

    def coach_only(self):
        if is_athlete(self.request.user):
            raise PermissionDenied("Only the coach can change a group or post in it.")

    def users(self, group: ChatGroup, extra=()) -> list[int]:
        """The group's coach and members (plus anyone just removed, so their app drops it)."""
        ids = list(Athlete.objects.filter(Q(chat_groups=group) | Q(pk__in=list(extra))).values_list("user_id", flat=True))
        return [group.coach.user_id, *ids]

    def changed(self, group: ChatGroup, extra=()) -> None:
        realtime.send_to_users(self.users(group, extra), {"type": "group.event", "group_id": group.pk})

    def perform_create(self, serializer):
        self.coach_only()
        group = serializer.save(coach=self.request.user.coach)
        self.changed(group)

    def perform_update(self, serializer):
        self.coach_only()
        before = set(serializer.instance.members.values_list("pk", flat=True))
        group = serializer.save()
        self.changed(group, extra=before)

    def perform_destroy(self, instance):
        self.coach_only()
        users = self.users(instance)
        for m in instance.messages.exclude(attachment=""):
            m.attachment.delete(save=False)
        gid = instance.pk
        instance.delete()
        realtime.send_to_users(users, {"type": "group.event", "group_id": gid})

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        # Re-read with the list annotations (member count, last post) as they are now.
        return Response(self.get_serializer(self.get_queryset().get(pk=kwargs["pk"])).data)

    def create(self, request, *args, **kwargs):
        self.coach_only()
        return super().create(request, *args, **kwargs)

    # --- messages ---

    @extend_schema(request=GroupMessageSerializer, responses=GroupMessageSerializer(many=True))
    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        group = self.get_object()
        if request.method == "GET":
            qs = group.messages.all()
            before = request.query_params.get("before", "")
            if before.isdigit():
                qs = qs.filter(pk__lt=before)
            ids = list(qs.order_by("-created_at", "-id").values_list("pk", flat=True)[: self.PAGE])
            rows = GroupMessage.objects.filter(pk__in=ids)
            return Response(GroupMessageSerializer(rows, many=True, context=self.get_serializer_context()).data)
        self.coach_only()
        s = GroupMessageSerializer(data=request.data, context=self.get_serializer_context())
        s.is_valid(raise_exception=True)
        msg = s.save(group=group)
        data = dict(s.data)
        realtime.send_to_users(self.users(group), {"type": "group.event", "group_id": group.pk, "message": data})
        coach = group.coach
        if not coach.in_quiet_hours():
            members = list(group.members.exclude(user=None).values_list("user_id", flat=True))
            push.notify(members, group.name, coach.user.name + ": " + msg.preview, {"type": "group", "groupId": group.pk, "messageId": msg.pk})
        return Response(data, status=201)

    @extend_schema(request=GroupMessageSerializer, responses=GroupMessageSerializer)
    @action(detail=True, methods=["patch", "delete"], url_path=r"messages/(?P<mid>\d+)")
    def message(self, request, pk=None, mid=None):
        self.coach_only()
        group = self.get_object()
        msg = get_object_or_404(group.messages, pk=mid)
        if msg.deleted_at:
            raise ValidationError({"detail": "This message was deleted."})
        if request.method == "DELETE":
            msg.soft_delete()
        else:
            text = str(request.data.get("text", "")).strip()
            if not text and not msg.attachment:
                raise ValidationError({"text": "Write a message or delete it."})
            msg.text, msg.edited_at = text, timezone.now()
            msg.save(update_fields=["text", "edited_at"])
        data = dict(GroupMessageSerializer(msg, context=self.get_serializer_context()).data)
        realtime.send_to_users(self.users(group), {"type": "group.event", "group_id": group.pk, "message": data, "update": True})
        return Response(data)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """The athlete opened the group: everything up to now is read."""
        group = self.get_object()
        n = 0
        if is_athlete(request.user):
            n = GroupMember.objects.filter(group=group, athlete=request.user.athlete).update(read_at=timezone.now())
        return Response({"updated": n})
