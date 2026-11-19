"""#81: coach broadcast groups — the coach builds a group from their athletes and posts; members only read."""

import pytest
from asgiref.sync import sync_to_async
from django.core.files.uploadedfile import SimpleUploadedFile

from messaging.models import ChatGroup
from messaging.push import app_path

from .conftest import Api, make_athlete
from .test_realtime import call, connect


def as_(user) -> Api:
    """A client of its own per user (`Api.as_user` switches the shared client in place)."""
    return Api().as_user(user)


@pytest.fixture
def team(coach):
    return [make_athlete(coach, f"a{i}@x.app", f"ورزشکار {i}") for i in range(3)]


@pytest.mark.django_db
def test_coach_creates_group_and_posts_members_read(django_capture_on_commit_callbacks, coach, other_coach, team, pushes):
    coach.quiet_hours = False
    coach.save()
    c = as_(coach.user)
    r = c.post("/api/chat-groups/", {"name": "تیم صبح", "members": [team[0].pk, team[1].pk]}, format="json")
    assert r.status_code == 201, r.data
    g = r.json()
    assert g["memberCount"] == 2 and sorted(g["members"]) == sorted([team[0].pk, team[1].pk])

    # Only the coach's own athletes can be added.
    stranger = make_athlete(other_coach, "s@x.app", "غریبه")
    assert c.patch(f"/api/chat-groups/{g['id']}/", {"members": [stranger.pk]}, format="json").status_code == 400

    as_(team[0].user).post("/api/devices/", {"token": "ExponentPushToken[m0]", "platform": "android"})
    as_(team[2].user).post("/api/devices/", {"token": "ExponentPushToken[m2]", "platform": "android"})
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post(f"/api/chat-groups/{g['id']}/messages/", {"text": "فردا تمرین ساعت ۷"}, format="json")
    assert r.status_code == 201
    # Members get a push; non-members don't.
    assert [p["to"] for p in pushes] == ["ExponentPushToken[m0]"]
    assert pushes[0]["title"] == "تیم صبح" and pushes[0]["data"]["type"] == "group"
    assert app_path(pushes[0]["data"]) == f"group/{g['id']}"

    # A member sees the group with one unread post, reads it, and can't post or manage the group.
    m = as_(team[0].user)
    rows = m.get("/api/chat-groups/").json()
    assert [x["name"] for x in rows] == ["تیم صبح"] and rows[0]["unread"] == 1 and rows[0]["lastText"] == "فردا تمرین ساعت ۷"
    assert "members" not in rows[0] and rows[0]["coachName"]
    assert [x["text"] for x in m.get(f"/api/chat-groups/{g['id']}/messages/").json()] == ["فردا تمرین ساعت ۷"]
    assert m.post(f"/api/chat-groups/{g['id']}/messages/", {"text": "باشه"}, format="json").status_code == 403
    assert m.post("/api/chat-groups/", {"name": "x"}, format="json").status_code == 403
    assert m.patch(f"/api/chat-groups/{g['id']}/", {"name": "y"}, format="json").status_code == 403
    assert m.delete(f"/api/chat-groups/{g['id']}/").status_code == 403
    m.post(f"/api/chat-groups/{g['id']}/read/")
    assert m.get("/api/chat-groups/").json()[0]["unread"] == 0

    # Non-members and other coaches don't see it.
    assert as_(team[2].user).get("/api/chat-groups/").json() == []
    assert as_(team[2].user).get(f"/api/chat-groups/{g['id']}/messages/").status_code == 404
    assert as_(other_coach.user).get(f"/api/chat-groups/{g['id']}/").status_code == 404


@pytest.mark.django_db
def test_edit_delete_members_and_media(coach, team):
    c = as_(coach.user)
    g = c.post("/api/chat-groups/", {"name": "دونده‌ها", "members": [team[0].pk]}, format="json").json()
    clip = SimpleUploadedFile("warmup.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 1024, content_type="video/mp4")
    r = c.post(f"/api/chat-groups/{g['id']}/messages/", {"text": "", "attachment": clip}, format="multipart")
    assert r.status_code == 201 and r.json()["attachment"].endswith(".mp4")
    assert c.get("/api/chat-groups/").json()[0]["lastText"] == "🎬 ویدیو"
    mid = c.post(f"/api/chat-groups/{g['id']}/messages/", {"text": "اول"}, format="json").json()["id"]
    assert c.patch(f"/api/chat-groups/{g['id']}/messages/{mid}/", {"text": "دوم"}, format="json").json()["editedAt"]
    assert c.delete(f"/api/chat-groups/{g['id']}/messages/{mid}/").json()["deleted"] is True
    assert c.post(f"/api/chat-groups/{g['id']}/messages/", {"text": " "}, format="json").status_code == 400

    # Renaming and changing members; a removed athlete loses access.
    r = c.patch(f"/api/chat-groups/{g['id']}/", {"name": "دونده‌های صبح", "members": [team[1].pk, team[2].pk]}, format="json")
    assert r.status_code == 200 and r.json()["memberCount"] == 2
    assert as_(team[0].user).get("/api/chat-groups/").json() == []
    assert len(as_(team[1].user).get(f"/api/chat-groups/{g['id']}/messages/").json()) == 2
    r = c.delete(f"/api/chat-groups/{g['id']}/")
    assert r.status_code == 204, r.content.decode()
    assert not ChatGroup.objects.exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_group_posts_are_pushed_live(coach, team):
    g = await sync_to_async(lambda: ChatGroup.objects.create(coach=coach, name="گروه"))()
    await sync_to_async(lambda: g.members.set([team[0]]))()
    member, outsider = await connect(team[0].user), await connect(team[1].user)
    await member.receive_json_from()
    await outsider.receive_json_from()
    r = await call(coach.user, "post", f"/api/chat-groups/{g.pk}/messages/", {"text": "سلام تیم"})
    assert r.status_code == 201
    ev = await member.receive_json_from()
    assert ev["type"] == "group" and ev["groupId"] == g.pk and ev["message"]["text"] == "سلام تیم"
    assert await outsider.receive_nothing()
    await member.disconnect()
    await outsider.disconnect()
