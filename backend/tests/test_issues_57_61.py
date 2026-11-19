"""Regression tests for GitHub issues #57–#61."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from messaging.models import Message

pytestmark = pytest.mark.django_db


def test_sender_edits_and_deletes_a_message_for_both_sides(api, coach, athlete, monkeypatch):
    """#59: the sender edits the text or deletes the message (file too); the other side can't; both see it live."""
    events = []
    monkeypatch.setattr("messaging.realtime.send_to_users", lambda users, ev: events.append(ev))
    api.as_user(athlete.user)
    m = api.post("/api/messages/", {"text": "سلام مربی"}).json()
    r = api.patch(f"/api/messages/{m['id']}/", {"text": "سلام مربی، امروز تمرین نمی‌رسم"}, format="json")
    assert r.status_code == 200 and r.json()["text"].endswith("نمی‌رسم") and r.json()["editedAt"]
    assert events[-1]["type"] == "chat.update"
    assert api.patch(f"/api/messages/{m['id']}/", {"text": "  "}, format="json").status_code == 400

    # the coach can't change the athlete's message, and sees it updated
    api.as_user(coach.user)
    assert api.patch(f"/api/messages/{m['id']}/", {"text": "x"}, format="json").status_code == 403
    assert api.delete(f"/api/messages/{m['id']}/").status_code == 403
    pic = SimpleUploadedFile("a.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, content_type="image/png")
    mine = api.post("/api/messages/", {"athlete": athlete.pk, "text": "عکس فرم", "attachment": pic}, format="multipart")
    assert mine.status_code == 201, mine.json()
    r = api.delete(f"/api/messages/{mine.json()['id']}/")
    assert r.status_code == 200 and r.json()["deleted"] is True and r.json()["text"] == "" and r.json()["attachment"] is None
    msg = Message.objects.get(pk=mine.json()["id"])
    assert msg.deleted_at and not msg.attachment
    assert api.patch(f"/api/messages/{msg.pk}/", {"text": "x"}, format="json").status_code == 400  # already deleted

    # the deleted message keeps its place in the thread
    thread = api.get(f"/api/messages/?athlete={athlete.pk}").json()
    assert [x["deleted"] for x in thread] == [False, True]


def test_program_can_start_today_on_any_weekday(coach, athlete, bench):
    """#61: weeks count from the start day; each day runs the session written for its weekday."""
    from datetime import date, timedelta

    from coaching.models import program_week_of
    from training import services
    from training.models import Program

    from .conftest import week

    friday = date(2026, 10, 2)
    assert friday.weekday() == 4
    assert program_week_of(friday, friday) == 1
    assert program_week_of(friday, friday + timedelta(days=6)) == 1  # Thursday: still week 1
    assert program_week_of(friday, friday + timedelta(days=7)) == 2  # next Friday: week 2

    p = Program.objects.create(coach=coach, name="دو هفته", duration_weeks=2, sessions_per_week=2, weeks=[week([bench.pk], weekdays=("fri", "sat"))] * 2)
    athlete.program, athlete.program_start = p, friday
    athlete.save()
    s = services.session_for(athlete, friday)
    assert s["week"] == 1 and s["weekday"] == "fri" and s["day"]["weekday"] == "fri"
    assert services.session_for(athlete, friday + timedelta(days=1))["day"]["weekday"] == "sat"
    # two full weeks: the Saturday 15 days later is week 3 → finished
    assert services.session_for(athlete, friday + timedelta(days=8))["week"] == 2
    assert services.session_for(athlete, friday + timedelta(days=15))["day"] is None
    assert services.session_for(athlete, friday - timedelta(days=1))["day"] is None  # before the start
