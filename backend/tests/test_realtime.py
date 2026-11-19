import pytest
from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator

from accounts.authentication import tokens_for
from config.asgi import application
from messaging.models import Device

from .conftest import Api

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]


async def connect(user):
    ws = WebsocketCommunicator(application, "/ws/")
    connected, _ = await ws.connect()
    assert connected
    token = await sync_to_async(lambda: tokens_for(user)["access"])()
    await ws.send_json_to({"type": "auth", "token": token})
    return ws


async def call(user, method, url, data=None):
    def _do():
        api = Api().as_user(user)
        return getattr(api, method)(url, data or {})

    return await sync_to_async(_do)()


async def test_messages_and_read_receipts_are_pushed_live(coach, athlete):
    coach_ws, athlete_ws = await connect(coach.user), await connect(athlete.user)
    assert (await coach_ws.receive_json_from())["type"] == "ready"
    assert (await athlete_ws.receive_json_from())["role"] == "athlete"

    r = await call(athlete.user, "post", "/api/messages/", {"text": "سلام مربی"})
    assert r.status_code == 201
    for ws in (coach_ws, athlete_ws):
        ev = await ws.receive_json_from()
        assert ev["type"] == "message" and ev["message"]["text"] == "سلام مربی" and ev["message"]["athleteId"] == athlete.pk

    await call(coach.user, "post", "/api/messages/read/", {"athlete": athlete.pk})
    ev = await athlete_ws.receive_json_from()
    assert ev["type"] == "read" and ev["reader"] == "coach"
    await coach_ws.receive_json_from()  # the coach gets the receipt too

    await coach_ws.send_json_to({"type": "typing", "athleteId": athlete.pk})
    assert await athlete_ws.receive_json_from() == {"type": "typing", "athleteId": athlete.pk, "sender": "coach"}
    await coach_ws.send_json_to({"type": "ping"})
    assert await coach_ws.receive_json_from() == {"type": "pong"}
    await coach_ws.disconnect()
    await athlete_ws.disconnect()


async def test_other_coaches_do_not_receive_events(coach, other_coach, athlete):
    spy = await connect(other_coach.user)
    await spy.receive_json_from()
    await call(athlete.user, "post", "/api/messages/", {"text": "خصوصی"})
    assert await spy.receive_nothing(timeout=0.3)
    await spy.disconnect()


async def test_bad_token_and_ended_sessions_close_the_socket(athlete):
    ws = WebsocketCommunicator(application, "/ws/")
    await ws.connect()
    await ws.send_json_to({"type": "auth", "token": "nope"})
    assert (await ws.receive_output())["code"] == 4001

    ws = await connect(athlete.user)
    await ws.receive_json_from()
    await sync_to_async(athlete.user.end_sessions)()
    assert (await ws.receive_output())["code"] == 4003


async def test_push_notification_for_coach_messages(coach, athlete, pushes):
    coach.quiet_hours = False  # the test may run at night
    await sync_to_async(coach.save)()
    token = "ExponentPushToken[abc123]"
    assert (await call(athlete.user, "post", "/api/devices/", {"token": "bad", "platform": "ios"})).status_code == 400
    assert (await call(athlete.user, "post", "/api/devices/", {"token": token, "platform": "ios"})).status_code == 201
    await call(athlete.user, "post", "/api/messages/", {"text": "from athlete"})
    assert pushes == []  # the coach uses the web panel
    await call(coach.user, "post", "/api/messages/", {"athlete": athlete.pk, "text": "ست آخر را ۶۷٫۵ بزن"})
    assert pushes == [
        {
            "to": token,
            "title": "علی احمدی",
            "body": "ست آخر را ۶۷٫۵ بزن",
            "data": {"type": "message", "athleteId": athlete.pk, "messageId": pushes[0]["data"]["messageId"]},
            "sound": "default",
        }
    ]
    await call(athlete.user, "delete", "/api/devices/", {"token": token})
    assert not await sync_to_async(Device.objects.exists)()


async def test_quiet_hours_skip_push(coach, athlete, pushes, monkeypatch):
    monkeypatch.setattr("coaching.models.Coach.in_quiet_hours", lambda self, now=None: True)
    await call(athlete.user, "post", "/api/devices/", {"token": "ExponentPushToken[q]", "platform": "ios"})
    r = await call(coach.user, "post", "/api/messages/", {"athlete": athlete.pk, "text": "شب بخیر"})
    assert r.status_code == 201 and pushes == []
