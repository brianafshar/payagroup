import pytest

from messaging import push
from messaging.models import Device

pytestmark = pytest.mark.django_db


def test_unregistered_push_tokens_are_removed(athlete, monkeypatch):
    Device.objects.create(user=athlete.user, token="ExponentPushToken[gone]", platform="android")
    monkeypatch.setattr(push, "_post", lambda m: {"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]})
    push._deliver([{"to": "ExponentPushToken[gone]"}])
    assert not Device.objects.exists()


def test_ending_sessions_forgets_push_tokens(athlete):
    Device.objects.create(user=athlete.user, token="ExponentPushToken[x]", platform="ios")
    athlete.user.end_sessions()
    assert not Device.objects.exists()


def test_push_backends(athlete, settings, monkeypatch, pushes, caplog):
    """Push is optional: log / off never call out; webhook posts once with every token, signed."""
    import hashlib
    import hmac
    import json

    Device.objects.create(user=athlete.user, token="pushe-token-12345", platform="android")
    settings.PUSH_BACKEND = "log"
    with caplog.at_level("INFO", logger="messaging.push"):
        push.send(["pushe-token-12345"], "مربی", "سلام")
    assert "سلام" in caplog.text and pushes == []

    calls = []

    def fake_urlopen(req, timeout=0):
        import io

        calls.append(req)
        return io.BytesIO(json.dumps({"invalid": ["pushe-token-12345"]}).encode())

    settings.PUSH_BACKEND = "webhook"
    settings.PUSH_WEBHOOK_URL = "https://relay.example/push"
    settings.PUSH_WEBHOOK_SECRET = "s3cret"
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    push.send(["pushe-token-12345"], "مربی", "سلام", {"type": "message"})
    body = calls[0].data
    assert json.loads(body) == {"tokens": ["pushe-token-12345"], "title": "مربی", "body": "سلام", "data": {"type": "message"}}
    sig = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    assert calls[0].get_header("X-baseline-signature") == sig
    assert not Device.objects.exists()  # the relay said the token is dead

    settings.PUSH_BACKEND = "off"
    push.send(["x" * 20], "a", "b")
    assert len(calls) == 1


def test_device_token_format_follows_the_backend(api, athlete, settings):
    api.as_user(athlete.user)
    assert api.post("/api/devices/", {"token": "pushe-token-12345", "platform": "android"}).status_code == 400
    settings.PUSH_BACKEND = "webhook"
    assert api.post("/api/devices/", {"token": "pushe-token-12345", "platform": "android"}).status_code == 201


def test_athlete_in_app_notifications(api, coach, assigned):
    """Without push the athlete still sees coach messages, plan changes and the check-in reminder."""
    from datetime import timedelta

    from django.utils import timezone

    from messaging.models import Message
    from training.models import Program

    athlete = assigned
    Program.objects.filter(pk=athlete.program_id).update(created_at=timezone.now() - timedelta(days=30))
    api.as_user(coach.user)
    api.post("/api/messages/", {"athlete": athlete.pk, "text": "ست آخر رو سنگین‌تر بزن"})
    api.put(f"/api/nutrition-plans/{athlete.pk}/", {"targets": {"kcal": 2400, "protein": 150, "carbs": 250, "fat": 70, "waterL": 3},
            "meals": [{"name": "صبحانه", "foods": []}]}, format="json")  # fmt: skip
    copy = Program.objects.get(pk=athlete.program_id)
    copy.name = copy.name + " "
    copy.save()

    api.as_user(athlete.user)
    r = api.get("/api/notifications/").json()
    kinds = {x["kind"] for x in r["results"]}
    assert {"message", "nutrition", "program"} <= kinds and r["unread"] == len(r["results"])
    msg = next(x for x in r["results"] if x["kind"] == "message")
    assert msg["value"] == 1 and msg["text"] == "ست آخر رو سنگین‌تر بزن"
    assert api.post("/api/notifications/read/").status_code == 204
    assert api.get("/api/notifications/").json()["unread"] == 0
    assert Message.objects.filter(athlete=athlete).count() == 1


def test_pushe_backend(api, coach, athlete, settings, monkeypatch, pushes, django_capture_on_commit_callbacks):
    """PUSH_BACKEND=pushe: the app registers its Pushe device id; the API sends Pushe "rapid"
    notifications to those ids, in batches of 500, with a baseline:// link to the screen."""
    import io
    import json

    settings.PUSH_BACKEND = "pushe"
    settings.PUSHE_API_TOKEN = "api-token"
    settings.PUSHE_APP_ID = "app123"
    calls = []

    def fake_urlopen(req, timeout=0):
        calls.append(req)
        return io.BytesIO(b'{"wrapper_id": "w1"}')

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    api.as_user(athlete.user)
    assert api.post("/api/devices/", {"token": "a1b2c3d4e5f6", "platform": "android"}).status_code == 201

    coach.quiet_hours = False
    coach.save()
    api.as_user(coach.user)
    with django_capture_on_commit_callbacks(execute=True):
        assert api.post("/api/messages/", {"athlete": athlete.pk, "text": "سلام، برنامه آپدیت شد"}, format="json").status_code == 201
    req = calls[-1]
    assert req.full_url == "https://api.pushe.co/v2/messaging/rapid/" and req.get_header("Authorization") == "Token api-token"
    body = json.loads(req.data)
    assert body["app_ids"] == ["app123"] and body["device_id"] == ["a1b2c3d4e5f6"]
    assert body["data"]["content"] == "سلام، برنامه آپدیت شد"
    assert body["data"]["action"] == {"action_type": "U", "url": "baseline://chat"}

    # More than 500 devices go out in several requests; missing credentials send nothing.
    calls.clear()
    push.send([f"d{i:06d}" for i in range(1200)], "t", "b", {"type": "feedback", "workoutId": 7})
    assert [len(json.loads(c.data)["device_id"]) for c in calls] == [500, 500, 200]
    assert json.loads(calls[0].data)["data"]["action"]["url"] == "baseline://session/7"
    calls.clear()
    settings.PUSHE_API_TOKEN = ""
    push.send(["a1b2c3d4e5f6"], "t", "b")
    assert calls == []


def test_web_push_for_browsers_and_iphone_home_screen_apps(api, coach, athlete, settings, monkeypatch, pushes, django_capture_on_commit_callbacks):
    """Browser subscriptions (platform web) get Web Push next to the phone backend; expired ones are
    removed; the API tells clients the VAPID public key."""
    import json

    import pywebpush
    from py_vapid import Vapid02, b64urlencode

    v = Vapid02()
    v.generate_keys()
    settings.WEBPUSH_PRIVATE_KEY = b64urlencode(v.private_key.private_numbers().private_value.to_bytes(32, "big"))
    settings.WEBPUSH_PUBLIC_KEY = "public-key"
    settings.PUSH_BACKEND = "off"
    sent = []

    class Gone:
        status_code = 410

    def fake_webpush(sub, data, **kw):
        if sub["endpoint"].endswith("/gone"):
            raise pywebpush.WebPushException("gone", response=Gone())
        sent.append((sub["endpoint"], json.loads(data)))

    monkeypatch.setattr(pywebpush, "webpush", fake_webpush)
    sub = {"endpoint": "https://web.push.apple.com/abc", "keys": {"p256dh": "BPk", "auth": "xyz"}}
    api.as_user(athlete.user)
    assert api.get("/api/push/config/").json() == {"webPushKey": "public-key"}
    assert api.post("/api/devices/", {"token": "not json", "platform": "web"}).status_code == 400
    assert api.post("/api/devices/", {"token": json.dumps(sub), "platform": "web"}, format="json").status_code == 201
    gone = {**sub, "endpoint": "https://fcm.googleapis.com/gone"}
    Device.objects.create(user=athlete.user, token=json.dumps(gone), platform="web")

    coach.quiet_hours = False
    coach.save()
    api.as_user(coach.user)
    with django_capture_on_commit_callbacks(execute=True):
        api.post("/api/messages/", {"athlete": athlete.pk, "text": "سلام"}, format="json")
    assert sent == [("https://web.push.apple.com/abc", {"title": coach.user.name, "body": "سلام", "url": "/chat", "data": sent[0][1]["data"]})]
    assert not Device.objects.filter(token=json.dumps(gone)).exists()

    settings.WEBPUSH_PRIVATE_KEY = ""
    assert api.get("/api/push/config/").json() == {"webPushKey": None}
