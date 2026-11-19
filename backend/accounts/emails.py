"""Transactional emails (Persian). Links are only ever sent by email in self-service flows."""

import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.exceptions import APIException

from core.text import fa_digits

KIND_LABEL = {"admin": "پنل مدیریت", "coach": "پنل مربی", "athlete": "اپلیکیشن ورزشکار"}


log = logging.getLogger("baseline.email")


class EmailNotSent(APIException):
    """The SMTP server refused or couldn't be reached; the request fails instead of pretending it was sent."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "The email could not be sent. Check the server's SMTP settings."
    default_code = "email_failed"


def _send(to: str, subject: str, body: str) -> None:
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)
    except (OSError, smtplib.SMTPException) as e:
        log.error("email to %s failed (%s): %s", to, subject, e)
        raise EmailNotSent() from e
    log.info("email sent to %s: %s", to, subject)


def send_invite(email: str, name: str, url: str, kind: str, inviter: str = "", app_name: str = "indow") -> None:
    by = f"{inviter} شما را دعوت کرده است" if inviter else "شما دعوت شده‌اید"
    _send(
        email,
        f"دعوت به {app_name}",
        f"سلام {name}،\n\n{by} تا به {KIND_LABEL.get(kind, app_name)} {app_name} بپیوندید.\n"
        f"برای ساخت رمز عبور و فعال‌سازی حساب روی لینک زیر بزنید:\n\n{url}\n\n"
        "این لینک ۷ روز معتبر است و فقط یک بار قابل استفاده است.",
    )


def send_reset(email: str, name: str, url: str) -> None:
    _send(
        email,
        "بازیابی رمز عبور",
        f"سلام {name}،\n\nبرای ساخت رمز عبور جدید روی لینک زیر بزنید:\n\n{url}\n\n"
        "این لینک ۲۴ ساعت معتبر است و فقط یک بار قابل استفاده است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.",
    )


def send_temporary_password(email: str, name: str, password: str) -> None:
    then = "بعد از ورود باید یک رمز دلخواه برای خودتان بگذارید."
    _send(
        email,
        "رمز عبور جدید شما",
        f"سلام {name}،\n\nبه درخواست شما برای حسابتان رمز عبور جدید ساخته شد:\n\n{password}\n\nبا این رمز وارد شوید. {then}\nرمز را در اختیار کسی قرار ندهید.",
    )


def send_new_password(email: str, name: str, password: str, force_change: bool) -> None:
    tail = "\nپس از ورود باید رمز عبور را تغییر دهید." if force_change else ""
    _send(email, "رمز عبور شما تغییر کرد", f"سلام {name}،\n\nرمز عبور جدید شما:\n\n{password}\n{tail}")


def send_renewal_request(email: str, coach_name: str, app_name: str, days_left: int | None) -> None:
    left = f" ({days_left} روز مانده)" if days_left is not None else ""
    _send(
        email,
        f"درخواست تمدید · {app_name}",
        f"{coach_name} ({app_name}) درخواست تمدید اعتبار حساب را ثبت کرد{left}.\nاز پنل مدیریت › مربیان می‌توانید حساب را تمدید کنید.",
    )


def send_expiry_reminder(email: str, name: str, days_left: int) -> None:
    _send(
        email,
        "حساب شما به‌زودی غیرفعال می‌شود",
        f"سلام {name}،\n\n{fa_digits(days_left)} روز دیگر حساب شما غیرفعال می‌شود. برای تمدید با پشتیبانی تماس بگیرید.\n"
        "اطلاعات شما حفظ می‌شود و پس از تمدید بازمی‌گردد.",
    )
