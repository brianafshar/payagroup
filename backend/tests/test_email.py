"""Email delivery (issue #27): "forgot password" emails a new random password, and SMTP failures
surface as `email_failed` instead of being hidden."""

import re
import smtplib

import pytest
from django.core import mail
from django.core.management import call_command

from accounts.models import PASSWORD_ALPHABET, User, random_password

from .conftest import PASSWORD, make_athlete
from .test_auth import login

pytestmark = pytest.mark.django_db
ME = "masoud13masoud83@gmail.com"


def password_in(message) -> str:
    return re.search(rf"^([{PASSWORD_ALPHABET}]{{10}})$", message.body, re.M).group(1)


def refuse(*a, **k):
    raise smtplib.SMTPAuthenticationError(535, b"Username and Password not accepted")


def test_random_password_mixes_letters_and_digits():
    for _ in range(50):
        pw = random_password()
        assert len(pw) == 10 and pw.isalnum() and any(c.isdigit() for c in pw) and any(c.isalpha() for c in pw)


def test_athlete_must_change_the_emailed_password(api, coach):
    make_athlete(coach, email=ME, name="مسعود")
    api.anon().post("/api/auth/forgot-password/", {"email": ME})
    r = login(api, ME, password_in(mail.outbox[0]))
    assert r.status_code == 200 and r.json()["user"]["forcePasswordChange"] is True


def test_coach_must_change_the_emailed_password(api, coach):
    User.objects.filter(pk=coach.user.pk).update(email=ME, username=ME)
    r = api.anon().post("/api/auth/forgot-password/", {"email": "nobody@example.com"})
    assert r.status_code == 204 and not mail.outbox
    assert api.post("/api/auth/forgot-password/", {"email": ME.upper()}).status_code == 204
    assert mail.outbox[0].to == [ME]
    new = password_in(mail.outbox[0])
    assert login(api, ME).status_code == 401  # the old password no longer works
    r = login(api, ME, new)
    assert r.status_code == 200 and r.json()["user"]["forcePasswordChange"] is True
    # choosing their own password clears the flag
    api.as_user(User.objects.get(email=ME))
    r = api.post("/api/auth/password/", {"currentPassword": new, "newPassword": "Masoud-own-1"})
    assert r.status_code == 200 and r.json()["user"]["forcePasswordChange"] is False


def test_forgot_password_keeps_the_old_password_when_the_email_fails(api, coach, monkeypatch):
    make_athlete(coach, email=ME, name="مسعود")
    monkeypatch.setattr("accounts.emails.send_mail", refuse)
    r = api.anon().post("/api/auth/forgot-password/", {"email": ME})
    assert r.status_code == 502 and r.json()["code"] == "email_failed"
    assert login(api, ME, PASSWORD).status_code == 200


def test_send_test_email_command(capsys):
    call_command("send_test_email", ME)
    assert mail.outbox[0].to == [ME] and "Sent to" in capsys.readouterr().out
