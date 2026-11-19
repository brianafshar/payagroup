"""WebSocket endpoint `/ws/` for live chat.

Protocol (JSON frames):
  client → {"type": "auth", "token": "<access JWT>"}   first frame, within 10 s
  server → {"type": "ready", "userId": 1, "role": "coach"}
  server → {"type": "message", "message": {…same shape as GET /api/messages/…}}
  server → {"type": "update", "message": {…}}           a message was edited or deleted (`deleted: true`)
  server → {"type": "read", "athleteId": 7, "reader": "coach", "at": "…"}
  server → {"type": "typing", "athleteId": 7, "sender": "athlete"}
  server → {"type": "program"}                         the coach changed the athlete's programs (#74): reload
  client → {"type": "typing", "athleteId": 7}         (athletes may omit athleteId)
  client → {"type": "ping"} → server {"type": "pong"}
The socket closes with code 4001 on a bad token and 4003 when the user's sessions are ended.
"""

import asyncio

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from djangorestframework_camel_case.util import camelize
from rest_framework.exceptions import APIException
from rest_framework_simplejwt.exceptions import TokenError

from accounts.sessions import group as session_group

from .realtime import group

AUTH_TIMEOUT = 10


@database_sync_to_async
def _user_from_token(token: str):
    from accounts.authentication import EpochJWTAuthentication

    auth = EpochJWTAuthentication()
    try:
        validated = auth.get_validated_token(token)
        user = auth.get_user(validated)
    except (TokenError, APIException):
        return None, None
    if user.role not in ("coach", "athlete") or user.mfa_setup_required:
        return None, None
    return user, validated.get("sid")


@database_sync_to_async
def _typing_target(user, athlete_id):
    """User id of the other side of the thread, if the sender may type in it."""
    from coaching.models import Athlete

    if user.role == "athlete":
        a = getattr(user, "athlete", None)
        return (a.pk, a.coach.user_id) if a else (None, None)
    a = Athlete.objects.filter(pk=athlete_id, coach__user=user).first()
    return (a.pk, a.user_id) if a else (None, None)


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    user = None

    async def connect(self):
        await self.accept()
        self._auth_timer = asyncio.create_task(self._close_if_not_authed())

    async def _close_if_not_authed(self):
        await asyncio.sleep(AUTH_TIMEOUT)
        if self.user is None:
            await self.close(code=4001)

    async def disconnect(self, code):
        if getattr(self, "_auth_timer", None):
            self._auth_timer.cancel()
        if self.user is not None:
            await self.channel_layer.group_discard(group(self.user.pk), self.channel_name)
            if getattr(self, "sid", None):
                await self.channel_layer.group_discard(session_group(self.sid), self.channel_name)

    async def receive_json(self, content, **kwargs):
        kind = content.get("type")
        if self.user is None:
            if kind != "auth":
                return await self.close(code=4001)
            self.user, self.sid = await _user_from_token(str(content.get("token", "")))
            if self.user is None:
                return await self.close(code=4001)
            await self.channel_layer.group_add(group(self.user.pk), self.channel_name)
            if self.sid:  # ending this device's session closes this socket only
                await self.channel_layer.group_add(session_group(self.sid), self.channel_name)
            return await self.send_json({"type": "ready", "userId": self.user.pk, "role": self.user.role})
        if kind == "ping":
            return await self.send_json({"type": "pong"})
        if kind == "typing":
            athlete_id, target = await _typing_target(self.user, content.get("athleteId"))
            if target:
                await self.channel_layer.group_send(group(target), {"type": "chat.typing", "athlete_id": athlete_id, "sender": self.user.role})

    # --- events from messaging.realtime ---

    async def chat_message(self, event):
        await self.send_json({"type": "message", "message": camelize(event["message"])})

    async def chat_update(self, event):
        await self.send_json({"type": "update", "message": camelize(event["message"])})

    async def chat_read(self, event):
        await self.send_json({"type": "read", "athleteId": event["athlete_id"], "reader": event["reader"], "at": event["at"]})

    async def group_event(self, event):
        """A coach broadcast group changed (#81): a new or edited post, or the group/its members."""
        out = {"type": "group", "groupId": event["group_id"]}
        if event.get("message"):
            out["message"] = camelize(event["message"])
            out["update"] = bool(event.get("update"))
        await self.send_json(out)

    async def program_changed(self, event):
        await self.send_json({"type": "program"})

    async def chat_typing(self, event):
        await self.send_json({"type": "typing", "athleteId": event["athlete_id"], "sender": event["sender"]})

    async def session_end(self, event):
        await self.close(code=4003)
