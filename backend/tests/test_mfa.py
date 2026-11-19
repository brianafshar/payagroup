import time

import pyotp
import pytest

from accounts.models import User
from core.models import AuditEvent, PlatformSettings

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


def enable(api, user) -> tuple[str, list[str]]:
    """Runs setup + enable for `user`; returns the secret and the recovery codes."""
    api.as_user(user)
    setup = api.post("/api/auth/2fa/setup/").json()
    assert setup["otpauthUrl"].startswith("otpauth://totp/indow:")
    r = api.post("/api/auth/2fa/enable/", {"otp": pyotp.TOTP(setup["secret"]).now()})
    assert r.status_code == 200, r.data
    return setup["secret"], r.json()["recoveryCodes"]


def login(api, user):
    return api.anon().post("/api/auth/login/", {"email": user.email, "password": PASSWORD}).json()


def test_enable_and_two_step_login(api, coach):
    assert api.as_user(coach.user).post("/api/auth/2fa/enable/", {"otp": "123456"}).data["code"] == "setup_required"
    api.post("/api/auth/2fa/setup/")
    assert api.post("/api/auth/2fa/enable/", {"otp": "000000"}).data["code"] == "invalid_code"
    secret, codes = enable(api, coach.user)
    assert len(codes) == 10 and api.get("/api/auth/2fa/").json() == {"enabled": True, "required": False, "recoveryCodesLeft": 10}

    step1 = login(api, coach.user)
    assert step1["mfaRequired"] is True and "access" not in step1
    bad = api.post("/api/auth/2fa/verify/", {"mfaToken": step1["mfaToken"], "otp": "999999"})
    assert bad.status_code == 400 and bad.data["code"] == "invalid_code"
    code = pyotp.TOTP(secret).at(time.time() + 30)  # the current step was used to enable
    ok = api.post("/api/auth/2fa/verify/", {"mfaToken": step1["mfaToken"], "otp": code})
    assert ok.status_code == 200 and ok.json()["user"]["twoFactor"] is True
    # the same code can't be used twice
    step1 = login(api, coach.user)
    assert api.post("/api/auth/2fa/verify/", {"mfaToken": step1["mfaToken"], "otp": code}).status_code == 400


def test_recovery_codes_work_once_and_persian_digits_are_accepted(api, coach):
    secret, codes = enable(api, coach.user)
    step1 = login(api, coach.user)
    assert api.post("/api/auth/2fa/verify/", {"mfaToken": step1["mfaToken"], "otp": codes[0].upper()}).status_code == 200
    assert api.anon().post("/api/auth/2fa/verify/", {"mfaToken": step1["mfaToken"], "otp": codes[0]}).status_code == 400
    User.objects.filter(pk=coach.user.pk).update(totp_last_step=None)
    fa = pyotp.TOTP(secret).now().translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    assert api.post("/api/auth/2fa/verify/", {"mfaToken": login(api, coach.user)["mfaToken"], "otp": fa}).status_code == 200


def test_bad_mfa_token(api):
    r = api.anon().post("/api/auth/2fa/verify/", {"mfaToken": "forged", "otp": "123456"})
    assert r.status_code == 400 and r.data["code"] == "mfa_token_expired"


def test_disable_needs_password_and_code(api, coach):
    secret, _ = enable(api, coach.user)
    User.objects.filter(pk=coach.user.pk).update(totp_last_step=None)
    assert api.post("/api/auth/2fa/disable/", {"password": "wrong", "otp": pyotp.TOTP(secret).now()}).status_code == 400
    assert api.post("/api/auth/2fa/disable/", {"password": PASSWORD, "otp": pyotp.TOTP(secret).now()}).status_code == 204
    assert "accessToken" not in login(api, coach.user) and "access" in login(api, coach.user)


def test_admin_policy_forces_setup(api, coach):
    admin = User.objects.create_user("new@baseline.app", PASSWORD, name="تازه", role="admin", admin_role="super")
    PlatformSettings.objects.update_or_create(pk=1, defaults={"require_admin_2fa": True})
    body = login(api, admin)
    assert body["user"]["mfaSetupRequired"] is True
    api.credentials(HTTP_AUTHORIZATION="Bearer " + body["access"])
    r = api.get("/api/coaches/")
    assert r.status_code == 403 and r.data["code"] == "mfa_setup_required"
    assert api.get("/api/auth/me/").status_code == 200  # auth endpoints stay reachable
    secret, _ = enable(api, admin)
    assert api.as_user(admin).get("/api/coaches/").status_code == 200
    User.objects.filter(pk=admin.pk).update(totp_last_step=None)
    r = api.post("/api/auth/2fa/disable/", {"password": PASSWORD, "otp": pyotp.TOTP(secret).now()})
    assert r.data["code"] == "mfa_required_by_policy"


def test_athletes_cannot_use_2fa_and_admin_reset(api, admin, athlete, coach):
    assert api.as_user(athlete.user).post("/api/auth/2fa/setup/").status_code == 403
    enable(api, coach.user)
    assert api.as_user(admin).post(f"/api/admin/users/{coach.user.pk}/2fa-reset/").status_code == 204
    assert "access" in login(api, coach.user)
    assert AuditEvent.objects.filter(action="mfa.reset").exists()


def test_coach_policy_and_admin_session_timeout(api, coach, admin, monkeypatch):
    import time as _time

    from accounts.authentication import tokens_for

    PlatformSettings.objects.update_or_create(pk=1, defaults={"require_coach_2fa": True, "session_timeout_minutes": 60})
    r = api.as_user(coach.user).get("/api/coach/profile/")
    assert r.status_code == 403 and r.data["code"] == "mfa_setup_required"
    refresh = tokens_for(admin)["refresh"]
    assert api.anon().post("/api/auth/refresh/", {"refresh": refresh}).status_code == 200
    real = _time.time
    monkeypatch.setattr(_time, "time", lambda: real() + 3601)
    r = api.anon().post("/api/auth/refresh/", {"refresh": tokens_for(admin)["refresh"]})
    assert r.status_code == 200  # a fresh sign-in is fine
    monkeypatch.setattr(_time, "time", real)
    old = tokens_for(admin)["refresh"]
    monkeypatch.setattr(_time, "time", lambda: real() + 3601)
    r = api.anon().post("/api/auth/refresh/", {"refresh": old})
    assert r.status_code == 401 and r.data["code"] == "session_timeout"
