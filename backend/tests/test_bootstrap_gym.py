import json
from io import StringIO

import pytest
from django.core.management import call_command

from accounts.models import User
from coaching.models import Coach

pytestmark = pytest.mark.django_db


def run(**kw):
    out = StringIO()
    call_command("bootstrap_gym", stdout=out, **kw)
    return json.loads(out.getvalue())


def test_creates_admin_and_head_coach_once():
    first = run()
    assert first["admin"]["username"] == "admin" and first["head_coach"]["username"] == "sarmoalem"
    head = Coach.objects.get(is_head=True)
    assert head.user.check_password(first["head_coach"]["password"]) and head.exercises.exists()
    assert User.objects.get(username="admin").is_superuser
    assert run() == {}  # idempotent


def test_given_passwords_are_used():
    out = run(head_password="Secret-1234", admin_password="Admin-1234")
    assert out["head_coach"]["password"] == "Secret-1234"
