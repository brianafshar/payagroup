"""Bale messenger (bale.ai) bot: the SMS texts also go to athletes who started the bot and shared their number.

Bale bots can't message a phone number cold, so each athlete opens the bot once and taps «share my number»; the
number is matched with the athlete's phone and the chat id is kept. `poll()` reads the bot's updates (no public
server needed: the desktop app asks Bale every few seconds)."""

import json
import logging
import re
import threading
import time
import urllib.error
import urllib.request

log = logging.getLogger(__name__)
API = "https://tapi.bale.ai/bot{token}/{method}"


class BaleError(Exception):
    pass


def _call(token: str, method: str, payload: dict | None = None, timeout: int = 15) -> dict:
    req = urllib.request.Request(  # noqa: S310 - fixed https host
        API.format(token=token, method=method),
        data=json.dumps(payload or {}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            raise BaleError(f"HTTP {e.code}") from e
    except Exception as e:
        raise BaleError(str(e)) from e
    if not body.get("ok"):
        raise BaleError(str(body.get("description") or "Bale refused the request."))
    return body.get("result")


def token() -> str:
    from core.models import SmsSettings

    row = SmsSettings.load()
    return row.bale_token.strip() if row.bale_enabled else ""


def normalize_phone(raw: str) -> str:
    """«+98 912 123 4567» / «989121234567» → «09121234567» ("" when it isn't an Iranian mobile)."""
    d = re.sub(r"\D", "", raw or "")
    if d.startswith("98") and len(d) == 12:
        d = "0" + d[2:]
    elif len(d) == 10 and d.startswith("9"):
        d = "0" + d
    return d if re.fullmatch(r"09\d{9}", d) else ""


def get_me(tok: str) -> dict:
    return _call(tok, "getMe")


def send_message(chat_id: int, text: str, tok: str | None = None, **extra) -> None:
    tok = tok or token()
    if not tok:
        raise BaleError("Bale is not enabled.")
    _call(tok, "sendMessage", {"chat_id": chat_id, "text": text, **extra})


def send_to_athlete(athlete, text: str) -> str:
    """`sent` · `not_enabled` · `not_linked` (athlete never started the bot) · `failed`. Never raises."""
    tok = token()
    if not tok:
        return "not_enabled"
    if not athlete.bale_chat_id:
        return "not_linked"
    try:
        send_message(athlete.bale_chat_id, text, tok)
        return "sent"
    except BaleError as e:
        log.warning("Bale message to athlete failed: %s", e)
        return "failed"


ASK = "برای دریافت پیام‌های باشگاه در بله، دکمه «اشتراک شماره من» را بزنید تا حساب شما شناسایی شود."
SHARE_KEYBOARD = {"keyboard": [[{"text": "اشتراک شماره من", "request_contact": True}]], "resize_keyboard": True, "one_time_keyboard": True}


def _handle(tok: str, msg: dict) -> None:
    from coaching.models import Athlete

    chat = (msg.get("chat") or {}).get("id")
    sender = (msg.get("from") or {}).get("id")
    if not chat:
        return
    contact = msg.get("contact")
    if contact:
        # Only the person's own contact counts, or anyone could claim another athlete's number.
        if contact.get("user_id") not in (None, sender):
            send_message(chat, "فقط شماره‌ی خودتان را می‌توانید به اشتراک بگذارید.", tok)
            return
        phone = normalize_phone(contact.get("phone_number", ""))
        athletes = list(Athlete.objects.filter(phone=phone)) if phone else []
        if not athletes:
            send_message(chat, "این شماره در باشگاه ثبت نشده است. با مربی‌تان هماهنگ کنید.", tok)
            return
        Athlete.objects.filter(pk__in=[a.pk for a in athletes]).update(bale_chat_id=chat)
        send_message(
            chat,
            f"{athletes[0].name} عزیز، حساب شما در بله ثبت شد. از این پس پیام‌های باشگاه اینجا هم برایتان می‌آید.",
            tok,
            reply_markup={"remove_keyboard": True},
        )
        return
    send_message(chat, ASK, tok, reply_markup=SHARE_KEYBOARD)


def poll_once() -> int:
    """Handle the bot's pending updates; returns how many were read."""
    from core.models import SmsSettings

    row = SmsSettings.load()
    tok = row.bale_token.strip() if row.bale_enabled else ""
    if not tok:
        return 0
    updates = _call(tok, "getUpdates", {"offset": row.bale_offset, "timeout": 0, "limit": 50}) or []
    for u in updates:
        try:
            if u.get("message"):
                _handle(tok, u["message"])
        except Exception:  # one bad update must not block the rest
            log.warning("Bale update failed", exc_info=True)
        row.bale_offset = max(row.bale_offset, int(u["update_id"]) + 1)
    if updates:
        SmsSettings.objects.filter(pk=row.pk).update(bale_offset=row.bale_offset)
    return len(updates)


_started = False


def start_polling(every: float = 5.0) -> None:
    """Background loop for the desktop app (idempotent). Bale being unreachable is normal: just try again later."""
    global _started
    if _started:
        return
    _started = True

    def loop():
        while True:
            try:
                poll_once()
            except Exception as e:
                log.debug("Bale poll: %s", e)
            time.sleep(every)

    threading.Thread(target=loop, daemon=True, name="bale-poll").start()
