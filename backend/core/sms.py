"""SMS through Kavenegar (https://kavenegar.com). Configure KAVENEGAR_API_KEY (+ KAVENEGAR_SENDER)."""

import json
import urllib.parse
import urllib.request

from django.conf import settings


class SmsNotConfigured(Exception):
    pass


class SmsError(Exception):
    pass


def credentials() -> tuple[str, str]:
    """(api key, sender): what the head coach saved in the app, else the environment."""
    from core.models import SmsSettings

    row = SmsSettings.load()
    return (row.api_key.strip() or settings.KAVENEGAR_API_KEY, row.sender.strip() or settings.KAVENEGAR_SENDER)


def send_sms(phone: str, message: str) -> None:
    key, sender = credentials()
    if not key:
        raise SmsNotConfigured("The Kavenegar API key is not set.")
    params = {"receptor": phone, "message": message}
    if sender:
        params["sender"] = sender
    url = f"https://api.kavenegar.com/v1/{key}/sms/send.json"
    try:
        with urllib.request.urlopen(url, data=urllib.parse.urlencode(params).encode(), timeout=15) as r:  # noqa: S310
            ok = json.loads(r.read()).get("return", {}).get("status") == 200
    except Exception as e:
        raise SmsError(str(e)) from e
    if not ok:
        raise SmsError("Kavenegar refused the message.")
