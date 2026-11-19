"""Voice messages in the coach ↔ athlete chat."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

pytestmark = pytest.mark.django_db


def _voice(name="voice.m4a", sec="12.4", **extra):
    return {"attachment": SimpleUploadedFile(name, b"\x00" * 2048, content_type="audio/mp4"), "voiceSec": sec, **extra}


def test_athlete_sends_a_voice_message_and_the_coach_sees_it(api, coach, athlete):
    api.as_user(athlete.user)
    r = api.post("/api/messages/", _voice(), format="multipart")
    assert r.status_code == 201, r.json()
    m = r.json()
    assert m["voiceSec"] == 12.4 and m["attachment"].endswith(".m4a") and m["text"] == ""

    api.as_user(coach.user)
    threads = api.get("/api/coach/threads/").json()
    assert threads[0]["lastText"] == "🎤 پیام صوتی ۰:۱۲"
    assert api.get(f"/api/messages/?athlete={athlete.pk}").json()[-1]["voiceSec"] == 12.4


def test_coach_voice_message_is_pushed_and_listed_for_the_athlete(api, coach, athlete, pushes, django_capture_on_commit_callbacks):
    from messaging.models import Device

    Device.objects.create(user=athlete.user, token="ExponentPushToken[v]", platform="android")
    coach.quiet_hours = False
    coach.save()
    api.as_user(coach.user)
    with django_capture_on_commit_callbacks(execute=True):
        r = api.post("/api/messages/", _voice("note.webm", "65", athlete=athlete.pk), format="multipart")
    assert r.status_code == 201, r.json()
    assert pushes[-1]["body"] == "🎤 پیام صوتی ۱:۰۵"
    api.as_user(athlete.user)
    item = next(x for x in api.get("/api/notifications/").json()["results"] if x["kind"] == "message")
    assert item["text"].startswith("🎤 پیام صوتی")


def test_voice_message_rules(api, athlete):
    api.as_user(athlete.user)
    # the recording must be audio, at most 5 minutes, and present
    assert api.post("/api/messages/", _voice("photo.png"), format="multipart").status_code == 400
    assert api.post("/api/messages/", _voice(sec="301"), format="multipart").status_code == 400
    assert api.post("/api/messages/", {"voiceSec": "3", "text": "x"}, format="multipart").status_code == 400
    # deleting removes the recording
    m = api.post("/api/messages/", _voice(), format="multipart").json()
    d = api.delete(f"/api/messages/{m['id']}/").json()
    assert d["deleted"] and d["attachment"] is None and d["voiceSec"] is None
