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


def brand_of(athlete: Athlete) -> str:
    return athlete.coach.app_name or "PAYA Group"


def publish_program(athlete: Athlete, *, sent_by=None, base_url: str = "") -> ProgramShare:
    """Render the athlete's current program PDF, publish it (gym site or this server) and keep the link."""
    token = secrets.token_urlsafe(24)
    data = render_pdf(athlete)
    url = site.publish_pdf(token=token, filename=filename(athlete), data=data, base_url=base_url)
    share = ProgramShare(athlete=athlete, sent_by=sent_by, token=token, url=url)
    share.pdf.save(f"{token}.pdf", ContentFile(data), save=False)
    share.save()
    return share


def send_account_created(athlete: Athlete) -> str:
    return _send(athlete.phone, f"{athlete.name} عزیز، حساب شما در {brand_of(athlete)} ساخته شد. به‌زودی برنامه تمرینی شما برایتان ارسال می‌شود.")


def send_program_assigned(athlete: Athlete, *, sent_by=None, base_url: str = "", note: str = "برنامه تمرینی جدید به شما اختصاص داده شد.") -> str:
    """`note` is the first sentence; the PDF link follows."""
    if not athlete.phone:
        return "no_phone"
    try:
        share = publish_program(athlete, sent_by=sent_by, base_url=base_url)
    except Exception:  # site API down, PDF engine missing…
        log.warning("Could not publish the program PDF", exc_info=True)
        return "failed"
    status = _send(athlete.phone, f"{athlete.name} عزیز، {note}\nدانلود برنامه:\n{share.url}\n{brand_of(athlete)}")
    if status == "sent":
        share.sms_sent = True
        share.save(update_fields=["sms_sent"])
    return status
