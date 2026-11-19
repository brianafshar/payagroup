"""Push notifications to the athlete app. Best effort: sent in a background thread after commit, and a
failed delivery never fails the request. The app works fully without push — every notification is also
in the athlete's in-app list (`GET /api/notifications/`) and chat arrives live over the WebSocket.

`PUSH_BACKEND` picks the delivery:

- `expo` — Expo's push service (relays to APNs / FCM). Needs a development/store build with an EAS
  project id. Expo refuses requests from sanctioned regions (Iran included), so run the API outside
  them or use `webhook`.
- `webhook` — POSTs `{"tokens", "title", "body", "data"}` to `PUSH_WEBHOOK_URL` (signed with
  `PUSH_WEBHOOK_SECRET` in `X-Baseline-Signature`, HMAC-SHA256 of the body). Point it at a small relay
  outside the sanctions or an adapter for a local service such as Pushe or Najva; it answers
  `{"invalid": [tokens]}` to have dead tokens removed.
- `pushe` — Pushe (pushe.co), an Iranian service, for Android: transactional ("rapid") notifications
  to the Pushe device ids the app registered. Needs `PUSHE_API_TOKEN` and `PUSHE_APP_ID`; works from
  servers in Iran. Tapping opens the right screen through a `baseline://` link.
- `log` — writes each notification to the server log (the development default).

Independently of `PUSH_BACKEND`, browsers (the coach panel, the athlete web app — on an iPhone once it
is added to the home screen, iOS 16.4+) get Web Push when VAPID keys are set (`WEBPUSH_PUBLIC_KEY`,
`WEBPUSH_PRIVATE_KEY`; `python manage.py webpush_keys`). Their device token is the subscription JSON.
- `off` — nothing.
"""

import hashlib
import hmac
import json
import logging
import threading
import urllib.request

from django.conf import settings
from django.db import transaction

log = logging.getLogger(__name__)
EXPO_URL = "https://exp.host/--/api/v2/push/send"
PUSHE_URL = "https://api.pushe.co/v2/messaging/rapid/"
PUSHE_BATCH = 500  # Pushe's limit of recipients per request
BACKENDS = ("expo", "pushe", "webhook", "log", "off")


def backend() -> str:
    return settings.PUSH_BACKEND if settings.PUSH_BACKEND in BACKENDS else "off"


def _post(messages: list[dict]) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
    req = urllib.request.Request(EXPO_URL, data=json.dumps(messages).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 — fixed https URL
        return json.loads(res.read().decode())


def _post_webhook(payload: dict) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode()
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.PUSH_WEBHOOK_SECRET:
        sig = hmac.new(settings.PUSH_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        headers["X-Baseline-Signature"] = "sha256=" + sig
    req = urllib.request.Request(settings.PUSH_WEBHOOK_URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 — URL set by the operator
        raw = res.read().decode()
        return json.loads(raw) if raw.strip() else {}


def _deliver(messages: list[dict]) -> None:
    """Expo: one message per token; tokens Expo reports as unregistered are removed."""
    from .models import Device

    try:
        tickets = _post(messages).get("data", [])
    except Exception:  # noqa: BLE001 — notifications are best effort
        log.warning("expo push failed (blocked region or no network?)", exc_info=True)
        return
    for msg, ticket in zip(messages, tickets, strict=False):
        if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
            Device.objects.filter(token=msg["to"]).delete()


def _deliver_webhook(payload: dict) -> None:
    from .models import Device

    if not settings.PUSH_WEBHOOK_URL:
        log.warning("PUSH_BACKEND=webhook but PUSH_WEBHOOK_URL is not set")
        return
    try:
        res = _post_webhook(payload)
    except Exception:  # noqa: BLE001
        log.warning("push webhook failed", exc_info=True)
        return
    invalid = res.get("invalid") or []
    if invalid:
        Device.objects.filter(token__in=invalid).delete()


def app_path(data: dict | None) -> str:
    """The app screen a notification opens, as a path of the app's links (`baseline://<path>`, `/<path>`)."""
    data = data or {}
    if data.get("type") == "message":
        return "chat"
    if data.get("type") == "group" and data.get("groupId"):
        return f"group/{data['groupId']}"
    if data.get("type") == "feedback" and data.get("workoutId"):
        return f"session/{data['workoutId']}"
    return "notifications"


def deep_link(data: dict | None) -> str:
    return "baseline://" + app_path(data)


def webpush_enabled() -> bool:
    return bool(settings.WEBPUSH_PUBLIC_KEY and settings.WEBPUSH_PRIVATE_KEY)


def _deliver_webpush(subscriptions: list[str], title: str, body: str, data: dict | None) -> None:
    """Web Push to browser subscriptions; expired ones (404 / 410) are removed."""
    from py_vapid import Vapid02
    from pywebpush import WebPushException, webpush

    from .models import Device

    key = Vapid02.from_raw(settings.WEBPUSH_PRIVATE_KEY.encode())
    payload = json.dumps({"title": title, "body": body, "url": "/" + app_path(data), "data": data or {}}, ensure_ascii=False)
    for sub in subscriptions:
        try:
            webpush(json.loads(sub), payload, vapid_private_key=key, vapid_claims={"sub": settings.WEBPUSH_SUBJECT}, ttl=86400, timeout=10)
        except WebPushException as e:
            if e.response is not None and e.response.status_code in (404, 410):
                Device.objects.filter(token=sub).delete()
            else:
                log.warning("web push failed: %s", e)
        except Exception:  # noqa: BLE001 — notifications are best effort
            log.warning("web push failed", exc_info=True)


def _post_pushe(payload: dict) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode()
    headers = {"Authorization": f"Token {settings.PUSHE_API_TOKEN}", "Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(PUSHE_URL, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 — fixed https URL
        raw = res.read().decode()
        return json.loads(raw) if raw.strip() else {}


def _deliver_pushe(tokens: list[str], title: str, body: str, data: dict | None) -> None:
    if not (settings.PUSHE_API_TOKEN and settings.PUSHE_APP_ID):
        log.warning("PUSH_BACKEND=pushe but PUSHE_API_TOKEN / PUSHE_APP_ID are not set")
        return
    content = {"title": title, "content": body, "action": {"action_type": "U", "url": deep_link(data)}}
    for i in range(0, len(tokens), PUSHE_BATCH):
        try:
            _post_pushe({"app_ids": [settings.PUSHE_APP_ID], "data": content, "device_id": tokens[i : i + PUSHE_BATCH]})
        except Exception:  # noqa: BLE001 — notifications are best effort
            log.warning("pushe push failed", exc_info=True)


def send(tokens: list[str], title: str, body: str, data: dict | None = None) -> None:
    """Deliver now (in this thread) with the configured backend."""
    kind = backend()
    body = body[:180]
    if not tokens or kind == "off":
        return
    if kind == "log":
        log.info("push → %d device(s): %s — %s %s", len(tokens), title, body, data or {})
    elif kind == "pushe":
        _deliver_pushe(tokens, title, body, data)
    elif kind == "webhook":
        _deliver_webhook({"tokens": tokens, "title": title, "body": body, "data": data or {}})
    else:
        _deliver([{"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"} for t in tokens])


def _send_all(tokens: list[str], web: list[str], title: str, body: str, data: dict | None) -> None:
    send(tokens, title, body, data)
    if web and webpush_enabled():
        _deliver_webpush(web, title, body[:180], data)


def notify(user_ids, title: str, body: str, data: dict | None = None) -> None:
    """Notify every registered device of these users, after the current transaction commits."""
    if backend() == "off" and not webpush_enabled():
        return
    from .models import Device

    def _send():
        rows = list(Device.objects.filter(user_id__in=[u for u in user_ids if u]).values_list("token", "platform"))
        web = [t for t, p in rows if p == Device.Platform.WEB]
        tokens = [t for t, p in rows if p != Device.Platform.WEB]
        if not tokens and not web:
            return
        if getattr(settings, "PUSH_SYNC", False):
            _send_all(tokens, web, title, body, data)
        else:
            threading.Thread(target=_send_all, args=(tokens, web, title, body, data), daemon=True).start()

    transaction.on_commit(_send)


def subscription_ok(token: str) -> bool:
    """A Web Push subscription (`PushSubscription.toJSON()`): https endpoint and its two keys."""
    try:
        sub = json.loads(token)
    except ValueError:
        return False
    keys = sub.get("keys") if isinstance(sub, dict) else None
    return str(sub.get("endpoint", "")).startswith("https://") and isinstance(keys, dict) and bool(keys.get("p256dh") and keys.get("auth"))


def token_ok(token: str, platform: str = "") -> bool:
    """Browsers send a Web Push subscription. For the phone apps Expo needs its own token format; other
    backends (Pushe's device id, a webhook's service) take whatever token their SDK gives the app."""
    if platform == "web":
        return subscription_ok(token)
    if backend() == "expo":
        return token.startswith(("ExponentPushToken[", "ExpoPushToken["))
    return 8 <= len(token) <= 255
