import re
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from accounts.models import Invite, User
from core.models import AuditEvent

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


def login(api, email, password=PASSWORD, **extra):
    return api.anon().post("/api/auth/login/", {"email": email, "password": password, **extra})


def link_token(text):
    return re.search(r"/(?:invite|reset)/([\w-]+)", text).group(1)


def test_login_returns_tokens_user_and_coach_branding(api, athlete):
    r = login(api, "ALI.ROSTAMI@gmail.com")
    assert r.status_code == 200
    assert {"access", "refresh", "user"} <= r.data.keys()
    user = r.json()["user"]
    assert user["role"] == "athlete" and user["athleteId"] == athlete.pk
    assert user["branding"]["appName"] == "Ali Fitness"


def test_login_failures(api, athlete, coach):
    assert login(api, athlete.email, "nope-nope").status_code == 401
    r = login(api, athlete.email, role="coach")
    assert r.status_code == 403 and r.data["code"] == "wrong_role"
    coach.expires_at = timezone.now() - timedelta(minutes=1)
    coach.save()
    r = login(api, coach.user.email)
    assert r.status_code == 403 and r.data["code"] == "coach_inactive"


def test_expired_coach_token_stops_working(api, coach):
    api.as_user(coach.user)
    assert api.get("/api/coach/profile/").status_code == 200
    coach.expires_at = timezone.now() - timedelta(seconds=1)
    coach.save()
    assert api.get("/api/coach/profile/").status_code == 401


def test_admin_password_change_ends_sessions_and_is_audited(api, admin, coach):
    old = login(api, coach.user.email).data
    api.as_user(admin)
    r = api.post(f"/api/admin/users/{coach.user.pk}/password/", {"password": "new-password-9", "forceChange": True, "emailUser": True})
    assert r.status_code == 204
    api.credentials(HTTP_AUTHORIZATION="Bearer " + old["access"])
    assert api.get("/api/auth/me/").status_code == 401
    assert api.anon().post("/api/auth/refresh/", {"refresh": old["refresh"]}).status_code == 401
    new = login(api, coach.user.email, "new-password-9")
    assert new.status_code == 200 and new.json()["user"]["forcePasswordChange"] is True
    assert "new-password-9" in mail.outbox[-1].body
    assert AuditEvent.objects.filter(action="password.change", actor=admin).exists()


def test_own_password_change_returns_fresh_tokens(api, athlete):
    api.as_user(athlete.user)
    r = api.post("/api/auth/password/", {"currentPassword": "wrong", "newPassword": "whatever-123"})
    assert r.status_code == 400
    r = api.post("/api/auth/password/", {"currentPassword": PASSWORD, "newPassword": "whatever-123"})
    assert r.status_code == 200
    api.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
    assert api.get("/api/auth/me/").status_code == 200


def test_athlete_invite_flow(api, coach):
    api.as_user(coach.user)
    r = api.post("/api/athletes/", {"name": "نیما کاظمی", "email": "nima@example.com", "invite": "link"})
    assert r.status_code == 201, r.data
    body = r.json()
    assert body["status"] == "invited" and body["inviteLink"]["url"]
    token = link_token(body["inviteLink"]["url"])
    assert AuditEvent.objects.filter(action="invite.copy").exists()

    info = api.anon().get(f"/api/auth/invites/{token}/").json()
    assert info["kind"] == "athlete" and info["name"] == "نیما کاظمی" and info["coachName"] == "علی احمدی" and not info["expired"]
    r = api.post(f"/api/auth/invites/{token}/", {"password": "short"})
    assert r.status_code == 400
    r = api.post(f"/api/auth/invites/{token}/", {"password": "my-password-1"})
    assert r.status_code == 201 and r.json()["user"]["role"] == "athlete"
    assert User.objects.get(email="nima@example.com").athlete.status == "active"
    # single use
    assert api.post(f"/api/auth/invites/{token}/", {"password": "my-password-1"}).status_code == 400
    assert api.get(f"/api/auth/invites/{token}/").json()["used"] is True


def test_expired_invite_is_refused(api, coach):
    api.as_user(coach.user)
    url = api.post("/api/athletes/", {"name": "x", "email": "x@example.com", "invite": "link"}).json()["inviteLink"]["url"]
    Invite.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    token = link_token(url)
    assert api.anon().get(f"/api/auth/invites/{token}/").json()["expired"] is True
    r = api.post(f"/api/auth/invites/{token}/", {"password": "my-password-1"})
    assert r.status_code == 400 and r.data["code"] == "invite_expired"


def test_logout_revokes_refresh_token(api, athlete):
    tokens = login(api, athlete.email).data
    api.credentials(HTTP_AUTHORIZATION="Bearer " + tokens["access"])
    assert api.post("/api/auth/logout/", {"refresh": tokens["refresh"]}).status_code == 204
    assert api.anon().post("/api/auth/refresh/", {"refresh": tokens["refresh"]}).status_code == 401


def test_logout_with_only_the_refresh_token(api, athlete):
    """Apps discard the access token first; the refresh token alone revokes the session."""
    tokens = login(api, athlete.email).data
    anon = api.anon()
    assert anon.post("/api/auth/logout/", {"refresh": tokens["refresh"]}).status_code == 204
    assert anon.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}).status_code == 401
    assert anon.post("/api/auth/logout/", {"all": True}).status_code == 401


def test_me_update_validates_phone_and_theme(api, athlete):
    api.as_user(athlete.user)
    assert api.patch("/api/auth/me/", {"phone": "12345"}).status_code == 400
    r = api.patch("/api/auth/me/", {"phone": "۰۹۱۲۱۲۳۴۵۶۷", "theme": "dark"})
    assert r.status_code == 200 and r.data["phone"] == "09121234567" and r.data["theme"] == "dark"
