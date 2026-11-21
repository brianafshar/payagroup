import pytest
from rest_framework.test import APIClient

from accounts.models import User
from coaching.models import AccountStatus, Athlete, Coach
from core import bale, notify, sms
from core.models import SmsSettings

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(monkeypatch):
    u = User.objects.create_user("c1", password="pw-12345678", name="C", role="coach")
    c = Coach.objects.create(user=u, app_name="PAYA", status=AccountStatus.ACTIVE)
    api = APIClient()
    api.force_authenticate(u)
    calls = []

    def fake(tok, method, payload=None, timeout=15):
        calls.append((method, payload))
        if method == "getMe":
            return {"username": "paya_bot"}
        if method == "getUpdates":
            return fake.updates
        return {}

    fake.updates = []
    monkeypatch.setattr(bale, "_call", fake)
    monkeypatch.setattr(sms, "send_sms", lambda phone, text: None)
    return c, api, calls, fake


def test_normalize_phone():
    assert bale.normalize_phone("+98 912 123 4567") == "09121234567"
    assert bale.normalize_phone("989121234567") == "09121234567"
    assert bale.normalize_phone("12345") == ""


def test_save_token_checks_bot_and_enables(setup):
    _, api, calls, _ = setup
    r = api.put("/api/bale-settings/", {"token": "abc123xyz"}, format="json")
    assert r.status_code == 200, r.content
    d = r.json()
    assert d["enabled"] and d["tokenSet"] and d["link"] == "https://ble.ir/paya_bot" and "abc" not in str(d)
    assert api.put("/api/bale-settings/", {"enabled": False}, format="json").json()["enabled"] is False


def test_contact_links_athlete_and_messages_follow(setup):
    c, api, calls, fake = setup
    api.put("/api/bale-settings/", {"token": "tok"}, format="json")
    a = Athlete.objects.create(coach=c, name="رضا", phone="09121234567", status=AccountStatus.ACTIVE)
    fake.updates = [
        {"update_id": 5, "message": {"chat": {"id": 77}, "from": {"id": 77}, "contact": {"phone_number": "989121234567", "user_id": 77}}},
    ]
    assert bale.poll_once() == 1
    a.refresh_from_db()
    assert a.bale_chat_id == 77 and SmsSettings.load().bale_offset == 6
    calls.clear()
    notify.send_account_created(a)
    assert any(m == "sendMessage" and p["chat_id"] == 77 for m, p in calls)


def test_someone_elses_contact_is_refused(setup):
    c, api, _, fake = setup
    api.put("/api/bale-settings/", {"token": "tok"}, format="json")
    a = Athlete.objects.create(coach=c, name="رضا", phone="09121234567", status=AccountStatus.ACTIVE)
    fake.updates = [{"update_id": 1, "message": {"chat": {"id": 9}, "from": {"id": 9}, "contact": {"phone_number": "09121234567", "user_id": 123}}}]
    bale.poll_once()
    a.refresh_from_db()
    assert a.bale_chat_id is None


def test_unlinked_athlete_gets_bot_link_in_sms(setup, monkeypatch):
    c, api, _, _ = setup
    api.put("/api/bale-settings/", {"token": "tok"}, format="json")
    sent = []
    monkeypatch.setattr(sms, "send_sms", lambda phone, text: sent.append(text))
    a = Athlete.objects.create(coach=c, name="رضا", phone="09121234567", status=AccountStatus.ACTIVE)
    notify.send_account_created(a)
    assert "https://ble.ir/paya_bot" in sent[0]


def test_disabled_bale_changes_nothing(setup, monkeypatch):
    c, _, calls, _ = setup
    sent = []
    monkeypatch.setattr(sms, "send_sms", lambda phone, text: sent.append(text))
    a = Athlete.objects.create(coach=c, name="رضا", phone="09121234567", status=AccountStatus.ACTIVE, bale_chat_id=5)
    notify.send_account_created(a)
    assert "ble.ir" not in sent[0] and not [m for m, _ in calls if m == "sendMessage"]
