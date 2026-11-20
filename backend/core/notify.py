"""SMS the athlete is sent by the system (no athlete app: SMS + a download link are the whole channel).

- account created → «حساب شما ساخته شد»
- program assigned → «برنامه به شما اختصاص داده شد» + link to the PDF on the gym site

Every function returns a short status (`sent` · `not_configured` · `failed` · `no_phone`) and never raises: a
missing SMS key or an offline site must not block the coach's work."""

import logging
import secrets

from django.core.files.base import ContentFile

from coaching.models import Athlete, ProgramShare
from core import site, sms
from core.models import SmsSettings
from core.pdf.program import filename, render_pdf

log = logging.getLogger(__name__)


def _send(phone: str, text: str) -> str:
    if not phone:
        return "no_phone"
    try:
        sms.send_sms(phone, text)
        return "sent"
    except sms.SmsNotConfigured:
        return "not_configured"
    except sms.SmsError:
        log.warning("SMS to athlete failed", exc_info=True)
        return "failed"


def brand_of_coach(coach) -> str:
    return coach.app_name or "PAYA Group"


def brand_of(athlete: Athlete) -> str:
    return brand_of_coach(athlete.coach)


def publish_program(athlete: Athlete, *, sent_by=None, base_url: str = "") -> ProgramShare:
    """Render the athlete's current program PDF, publish it (gym site or this server) and keep the link."""
    token = secrets.token_urlsafe(24)
    data = render_pdf(athlete)
    url = site.publish_pdf(token=token, filename=filename(athlete), data=data, base_url=base_url)
    share = ProgramShare(athlete=athlete, sent_by=sent_by, token=token, url=url)
    share.pdf.save(f"{token}.pdf", ContentFile(data), save=False)
    share.save()
    return share


class _Safe(dict):
    def __missing__(self, key):  # unknown {placeholder} stays as typed instead of crashing
        return "{" + key + "}"


def render_text(template: str, **values: str) -> str:
    try:
        return template.format_map(_Safe(values))
    except (ValueError, IndexError, KeyError, AttributeError):
        return template


def send_account_created(athlete: Athlete) -> str:
    return _send(athlete.phone, render_text(SmsSettings.load().account_text, name=athlete.name, brand=brand_of(athlete)))


def send_program_assigned(athlete: Athlete, *, sent_by=None, base_url: str = "") -> str:
    if not athlete.phone:
        return "no_phone"
    try:
        share = publish_program(athlete, sent_by=sent_by, base_url=base_url)
    except Exception:  # site API down, PDF engine missing…
        log.warning("Could not publish the program PDF", exc_info=True)
        return "failed"
    text = render_text(SmsSettings.load().program_text, name=athlete.name, brand=brand_of(athlete), link=share.url)
    status = _send(athlete.phone, text)
    if status == "sent":
        share.sms_sent = True
        share.save(update_fields=["sms_sent"])
    return status
