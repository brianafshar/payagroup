"""#102: an admin deletes an athlete or a whole coach for good — every record and uploaded file goes."""

import pytest
from django.core.files.base import ContentFile

from accounts.models import User
from coaching.models import Athlete, Coach
from messaging.models import Message
from training.models import Exercise, Program, WorkoutLog

from .conftest import Api, make_athlete

pytestmark = pytest.mark.django_db


def _attach(athlete) -> str:
    m = Message.objects.create(athlete=athlete, sender="athlete", text="")
    m.attachment.save("photo.jpg", ContentFile(b"x"), save=True)
    return m.attachment.name


def test_admin_deletes_athlete_and_files(admin, assigned, django_capture_on_commit_callbacks):
    name = _attach(assigned)
    storage = Message._meta.get_field("attachment").storage
    assert storage.exists(name)
    user_id = assigned.user_id
    with django_capture_on_commit_callbacks(execute=True):
        assert Api().as_user(admin).delete(f"/api/athletes/{assigned.pk}/").status_code == 204
    assert not Athlete.objects.filter(pk=assigned.pk).exists() and not User.objects.filter(pk=user_id).exists()
    assert not WorkoutLog.objects.exists() and not Message.objects.exists()
    assert not storage.exists(name)


def test_admin_deletes_coach_with_everything(admin, coach, assigned, django_capture_on_commit_callbacks):
    second = make_athlete(coach, email="b@example.com", name="دوم", with_user=False)
    ex = Exercise.objects.filter(coach=coach).first()
    ex.image.save("cover.png", ContentFile(b"x"), save=True)
    files = [_attach(assigned), ex.image.name]
    storage = ex.image.storage
    coach_user = coach.user_id
    with django_capture_on_commit_callbacks(execute=True):
        r = Api().as_user(admin).delete(f"/api/coaches/{coach.pk}/")
    assert r.status_code == 204, r.content
    assert not Coach.objects.filter(pk=coach.pk).exists() and not User.objects.filter(pk=coach_user).exists()
    assert not Athlete.objects.filter(pk__in=[assigned.pk, second.pk]).exists()
    assert not Program.objects.exists() and not Exercise.objects.filter(coach_id=coach.pk).exists()
    assert not any(storage.exists(f) for f in files)


def test_only_allowed_people_delete(coach, other_coach, athlete, support):
    from core.permissions import admin_can

    assert Api().as_user(coach.user).delete(f"/api/coaches/{coach.pk}/").status_code == 403
    assert Api().as_user(other_coach.user).delete(f"/api/athletes/{athlete.pk}/").status_code == 404
    r = Api().as_user(support).delete(f"/api/coaches/{other_coach.pk}/")
    assert r.status_code == (204 if admin_can(support, "cm") else 403)
