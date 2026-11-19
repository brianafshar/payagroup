import pytest
from rest_framework.test import APIClient

from accounts.models import User
from coaching.models import AccountStatus, Athlete, Coach, ProgramShare
from core import sms

pytestmark = pytest.mark.django_db


def coach_client():
    u = User.objects.create_user("c1", password="pw-12345678", name="C", role="coach")
    c = Coach.objects.create(user=u, app_name="PAYA", status=AccountStatus.ACTIVE)
    api = APIClient()
    api.force_authenticate(u)
    return c, api


def test_send_sms_saves_contact_once_and_sends_link(monkeypatch, settings):
    sent = []
    monkeypatch.setattr(sms, "send_sms", lambda phone, text: sent.append((phone, text)))
    settings.KAVENEGAR_API_KEY = "k"
    c, api = coach_client()
    r = api.post("/api/program-pdf/send-sms/", {"name": "رضا", "phone": "۰۹۱۲۱۲۳۴۵۶۷"}, format="json")
    assert r.status_code == 201, r.content
    assert Athlete.objects.filter(coach=c, phone="09121234567", name="رضا").count() == 1
    assert sent[0][0] == "09121234567" and r.json()["url"] in sent[0][1]
    # second send finds the saved contact by phone — no duplicate
    api.post("/api/program-pdf/send-sms/", {"phone": "09121234567"}, format="json")
    assert Athlete.objects.filter(coach=c).count() == 1 and ProgramShare.objects.count() == 2
    # the link serves the PDF
    token = ProgramShare.objects.first().token
    assert APIClient().get(f"/api/shared-pdf/{token}/").status_code == 200


def test_sms_not_configured_is_reported(settings):
    settings.KAVENEGAR_API_KEY = ""
    _, api = coach_client()
    r = api.post("/api/program-pdf/send-sms/", {"name": "A", "phone": "09121234567"}, format="json")
    assert r.status_code == 503 and r.json()["code"] == "sms_not_configured"


def test_bad_phone_and_missing_name():
    _, api = coach_client()
    assert api.post("/api/program-pdf/send-sms/", {"name": "A", "phone": "123"}, format="json").status_code == 400
    assert api.post("/api/program-pdf/send-sms/", {"phone": "09121234567"}, format="json").status_code == 400


def test_pdf_exercise_names_link_to_the_site(settings):
    from core import site
    from training.models import Exercise

    c, _ = coach_client()
    ex = Exercise.objects.create(coach=c, name="Squat", library_key="squat")
    assert site.exercise_url(ex) == f"{settings.SITE_URL}/training/squat"
    ex2 = Exercise.objects.create(coach=c, name="Mine")
    assert site.exercise_url(ex2).endswith(f"/training/x{ex2.pk}")
