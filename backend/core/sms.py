"""SMS through Kavenegar (https://kavenegar.com). Configure KAVENEGAR_API_KEY (+ KAVENEGAR_SENDER)."""

import json
import urllib.parse
import urllib.request

from django.conf import settings


class SmsNotConfigured(Exception):
    pass


class SmsError(Exception):
    pass


def send_sms(phone: str, message: str) -> None:
    if not settings.KAVENEGAR_API_KEY:
        raise SmsNotConfigured("KAVENEGAR_API_KEY is not set.")
    params = {"receptor": phone, "message": message}
    if settings.KAVENEGAR_SENDER:
        params["sender"] = settings.KAVENEGAR_SENDER
    url = f"https://api.kavenegar.com/v1/{settings.KAVENEGAR_API_KEY}/sms/send.json"
    try:
        with urllib.request.urlopen(url, data=urllib.parse.urlencode(params).encode(), timeout=15) as r:  # noqa: S310
            ok = json.loads(r.read()).get("return", {}).get("status") == 200
    except Exception as e:
        raise SmsError(str(e)) from e
    if not ok:
        raise SmsError("Kavenegar refused the message.")
