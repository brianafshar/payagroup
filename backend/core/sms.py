"""SMS through Kavenegar (https://kavenegar.com). Configure KAVENEGAR_API_KEY (+ KAVENEGAR_SENDER)."""

import json
import urllib.error
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
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:  # Kavenegar answers refusals (412 …) with an HTTP error + JSON body
        try:
            body = json.loads(e.read())
        except Exception:
            raise SmsError(f"HTTP {e.code}") from e
    except Exception as e:
        raise SmsError(str(e)) from e
    ret = body.get("return", {})
    if ret.get("status") != 200:
        raise SmsError(f"{ret.get('status')}: {ret.get('message') or 'Kavenegar refused the message.'}")
