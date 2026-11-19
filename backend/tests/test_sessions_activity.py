"""Device sessions (sign-in per device, ended by the user or an admin) and admin activity analytics."""

import pytest
from rest_framework.test import APIClient

from messaging.models import Device
from tests.conftest import PASSWORD

pytestmark = pytest.mark.django_db


def sign_in(email, client="panel", ua="Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36"):
    c = APIClient(HTTP_USER_AGENT=ua, HTTP_X_CLIENT=client)
    r = c.post("/api/auth/login/", {"email": email, "password": PASSWORD}, format="json").json()
    c.credentials(HTTP_AUTHORIZATION="Bearer " + r["access"])
    return c, r


def test_each_sign_in_is_a_device_session_the_user_can_end(athlete):
    phone, p = sign_in(athlete.user.email, "app-android", "okhttp/4.12")
    laptop, _ = sign_in(athlete.user.email, "app-web", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Safari/605.1.15")
    phone.post("/api/devices/", {"token": "ExponentPushToken[p]", "platform": "android"}, format="json")

    rows = laptop.get("/api/auth/sessions/").json()
    assert {r["device"] for r in rows} == {"اپ اندروید", "اپ وب · Safari · macOS"}
    assert [r["current"] for r in rows if r["device"].startswith("اپ وب")] == [True]

    other = next(r for r in rows if not r["current"])
    assert laptop.delete(f"/api/auth/sessions/{other['id']}/").status_code == 204
    assert phone.get("/api/auth/me/").status_code == 401  # the phone is signed out…
    assert APIClient().post("/api/auth/refresh/", {"refresh": p["refresh"]}, format="json").status_code == 401
    assert not Device.objects.filter(token="ExponentPushToken[p]").exists()  # …and gets no more pushes
    assert laptop.get("/api/auth/me/").status_code == 200  # this device stays signed in
    assert [r["current"] for r in laptop.get("/api/auth/sessions/").json()] == [True]


def test_sign_out_everywhere_else_and_no_limit_on_sign_ins(coach):
    devices = [sign_in(coach.user.email)[0] for _ in range(5)]  # no limit
    assert len(devices[0].get("/api/auth/sessions/").json()) == 5
    assert devices[0].post("/api/auth/sessions/end-others/").json() == {"ended": 4}
    assert devices[1].get("/api/auth/me/").status_code == 401 and devices[0].get("/api/auth/me/").status_code == 200


def test_logout_ends_that_session(coach):
    c, r = sign_in(coach.user.email)
    c.post("/api/auth/logout/", {"refresh": r["refresh"]}, format="json")
    assert c.get("/api/auth/me/").status_code == 401
    assert coach.user.login_sessions.get().ended_by == "logout"


def test_admin_sees_and_ends_a_users_sessions(api, admin, support, coach, athlete):
    a1, _ = sign_in(athlete.user.email, "app-android", "okhttp/4.12")
    a2, _ = sign_in(athlete.user.email, "app-web")
    api.as_user(admin)
    rows = api.get(f"/api/admin/users/{athlete.user_id}/sessions/").json()
    assert len(rows) == 2
    android = next(r for r in rows if r["client"] == "app-android")
    assert api.delete(f"/api/admin/users/{athlete.user_id}/sessions/{android['id']}/").status_code == 204
    assert a1.get("/api/auth/me/").status_code == 401 and a2.get("/api/auth/me/").status_code == 200
    assert api.post(f"/api/admin/users/{athlete.user_id}/sessions/").status_code == 200
    assert a2.get("/api/auth/me/").status_code == 401
    # Support admins (no `cm` in the default matrix) can't touch coaches' sessions.
    assert api.as_user(support).get(f"/api/admin/users/{coach.user_id}/sessions/").status_code == 403


def test_clients_report_section_time_and_admins_see_the_activity(api, admin, coach, athlete):
    from core.models import SectionUsage

    c, _ = sign_in(coach.user.email)
    a, _ = sign_in(athlete.user.email, "app-android", "okhttp/4.12")
    assert (
        c.post(
            "/api/activity/", {"items": [{"section": "coach:chat", "seconds": 90, "visits": 1}, {"section": "coach:dashboard", "seconds": 30}]}, format="json"
        ).status_code
        == 204
    )
    c.post("/api/activity/", {"items": [{"section": "coach:chat", "seconds": 5000}]}, format="json")  # capped at 10 min
    a.post("/api/activity/", {"items": [{"section": "app:Workout", "seconds": 120, "visits": 2}, {"section": "app:Chat", "seconds": 60}]}, format="json")
    assert c.post("/api/activity/", {"items": [{"section": "<script>", "seconds": 1}]}, format="json").status_code == 400
    assert SectionUsage.objects.get(user=coach.user, section="coach:chat").seconds == 690

    r = api.as_user(admin).get("/api/admin/activity/?days=7").json()
    assert r["online"] == {"coach": 1, "athlete": 1}
    assert r["activeToday"] == {"coach": 1, "athlete": 1} and r["signIns"] == 2
    top = {(x["section"], x["role"]): x["minutes"] for x in r["sections"]}
    assert top[("coach:chat", "coach")] == 11.5 and top[("app:Workout", "athlete")] == 2.0
    assert r["sections"][0]["section"] == "coach:chat"
    assert {u["name"] for u in r["users"]} == {coach.user.name, athlete.user.name}
    assert next(u for u in r["users"] if u["role"] == "athlete")["topSection"] == "app:Workout"
    assert {x["device"] for x in r["recentLogins"]} == {"Chrome · Windows", "اپ اندروید"}

    u = api.get(f"/api/admin/activity/users/{athlete.user_id}/?days=7").json()
    assert [x["section"] for x in u["sections"]] == ["app:Workout", "app:Chat"] and u["daily"][-1]["minutes"] == 3.0
    assert u["signIns"][0]["device"] == "اپ اندروید"
    # Only admins with reports permission.
    assert api.as_user(coach.user).get("/api/admin/activity/").status_code == 403
