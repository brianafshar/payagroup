import pytest
from django.core.files.base import ContentFile
from rest_framework.test import APIClient

from core import site
from training.models import Exercise

from .conftest import make_coach

pytestmark = pytest.mark.django_db


def test_exercise_with_video_is_pushed_to_the_site(settings, monkeypatch):
    settings.SITE_API_URL = "https://site.test/api"
    settings.SITE_API_KEY = "k"
    c = make_coach()
    ex = Exercise.objects.create(coach=c, name="Squat", category="legs", equipment="barbell", description="d")
    assert site.sync_exercise(ex) == "skipped"  # no video yet

    ex.video.save("squat.mp4", ContentFile(b"\x00video"), save=True)
    sent = {}

    class Resp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b"{}"

    def fake_open(req, timeout=0):
        sent.update(url=req.full_url, method=req.get_method(), key=req.headers.get("X-api-key"), body=req.data)
        return Resp()

    monkeypatch.setattr(site.urllib.request, "urlopen", fake_open)
    assert site.sync_exercise(ex) == "synced"
    assert sent["url"] == f"https://site.test/api/exercises/{ex.pk}" and sent["method"] == "PUT" and sent["key"] == "k"
    assert b'name="video"' in sent["body"] and b"\x00video" in sent["body"] and b"Squat" in sent["body"]
    ex.refresh_from_db()
    assert ex.site_synced_at and not ex.site_error

    def boom(req, timeout=0):
        raise OSError("offline")

    monkeypatch.setattr(site.urllib.request, "urlopen", boom)
    assert site.sync_exercise(ex) == "failed"
    ex.refresh_from_db()
    assert ex.site_synced_at is None and "offline" in ex.site_error


def test_sync_site_endpoint_head_only(settings):
    head = make_coach("h@x.io", is_head=True)
    plain = make_coach("p@x.io", head=head)
    c = APIClient()
    c.force_authenticate(plain.user)
    assert c.post("/api/exercises/sync-site/").status_code == 403
    c.force_authenticate(head.user)
    assert c.post("/api/exercises/sync-site/").status_code == 400  # no SITE_API_URL
