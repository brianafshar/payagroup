from datetime import timedelta

import pyotp
import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.authentication import tokens_for
from accounts.models import User
from coaching.models import Athlete, Coach
from training.models import Exercise, Program

PASSWORD = "correct-horse-1"


@pytest.fixture(autouse=True)
def _clean(settings, tmp_path):
    cache.clear()  # auth throttling counters
    settings.MEDIA_ROOT = tmp_path
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    settings.EXERCISE_ILLUSTRATIONS = False  # no downloads in tests (see test_library_illustrations)


@pytest.fixture(autouse=True)
def pushes(settings, monkeypatch):
    """Push notifications are captured here instead of calling Expo."""
    sent: list[dict] = []
    settings.PUSH_SYNC = True
    settings.PUSH_BACKEND = "expo"

    def fake_post(messages):
        sent.extend(messages)
        return {"data": [{"status": "ok"} for _ in messages]}

    monkeypatch.setattr("messaging.push._post", fake_post)
    return sent


class Api(APIClient):
    def as_user(self, user):
        self.credentials(HTTP_AUTHORIZATION="Bearer " + tokens_for(user)["access"])
        return self

    def anon(self):
        self.credentials()
        return self


@pytest.fixture
def api():
    return Api()


def make_admin(email="sina@baseline.app", role="super"):
    # 2FA on, so the "admins must use 2FA" policy doesn't get in the way of the other tests.
    return User.objects.create_user(email, PASSWORD, name="سینا توکلی", role="admin", admin_role=role, two_factor=True, totp_secret=pyotp.random_base32())


def make_coach(email="ali@alifitness.app", **kw):
    user = User.objects.create_user(email, PASSWORD, name="علی احمدی", role="coach")
    defaults = {
        "app_name": "Ali Fitness",
        "status": "active",
        "validity_days": 90,
        "activated_at": timezone.now(),
        "expires_at": timezone.now() + timedelta(days=42),
    }
    return Coach.objects.create(user=user, **{**defaults, **kw})


def make_athlete(coach, email="ali.rostami@gmail.com", name="علی رستمی", with_user=True, **kw):
    user = User.objects.create_user(email, PASSWORD, name=name, role="athlete") if with_user else None
    return Athlete.objects.create(coach=coach, user=user, name=name, email=email, status="active" if with_user else "draft", **kw)


@pytest.fixture
def admin(db):
    return make_admin()


@pytest.fixture
def support(db):
    return make_admin("support@baseline.app", "support")


@pytest.fixture
def coach(db):
    return make_coach()


@pytest.fixture
def other_coach(db):
    return make_coach("mina@northline.app", app_name="Northline Endurance")


@pytest.fixture
def athlete(coach):
    return make_athlete(coach)


@pytest.fixture
def bench(coach):
    return Exercise.objects.create(coach=coach, name="پرس سینه هالتر", category="chest", equipment="barbell", unit="kg")


@pytest.fixture
def squat(coach):
    return Exercise.objects.create(coach=coach, name="اسکوات هالتر", category="legs", equipment="barbell", unit="kg")


def week(ex_ids, weekdays=("sat", "sun", "mon", "tue", "wed", "thu", "fri"), sets=((8, 70.0),) * 3):
    """One week where every listed weekday trains the given exercises."""
    return {
        "index": 1,
        "days": [
            {
                "weekday": d,
                "focus": "بالاتنه",
                "rest": False,
                "exercises": [{"exercise_id": e, "sets": [{"reps": str(r), "value": v, "unit": "kg", "rest_sec": 90} for r, v in sets]} for e in ex_ids],
            }
            for d in weekdays
        ],
    }


@pytest.fixture
def program(coach, bench, squat):
    p = Program.objects.create(coach=coach, name="عضله‌سازی ۸ هفته", duration_weeks=8, sessions_per_week=7, weeks=[week([bench.pk, squat.pk])])
    p.sync_exercises()
    return p


@pytest.fixture
def assigned(athlete, program):
    """The athlete trains `program` (their own copy) starting today."""
    from training.services import assign

    assign(program, [athlete], timezone.localdate())
    athlete.refresh_from_db()
    return athlete
