"""`python manage.py send_test_email you@example.com` — checks the SMTP settings end to end."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts import emails


class Command(BaseCommand):
    help = "Send a test email to check the SMTP configuration."

    def add_arguments(self, parser):
        parser.add_argument("to")

    def handle(self, to, **opts):
        backend = settings.EMAIL_BACKEND.rsplit(".", 2)[-2]
        host = getattr(settings, "EMAIL_HOST", "")
        self.stdout.write(f"backend={backend} host={host or '-'} port={getattr(settings, 'EMAIL_PORT', '-')} from={settings.DEFAULT_FROM_EMAIL}")
        if backend == "console":
            self.stdout.write(self.style.WARNING("EMAIL_HOST is not set: the email is only printed below, nothing is delivered."))
        try:
            emails._send(to, "ایمیل آزمایشی indow", "اگر این ایمیل را می‌بینید، تنظیمات ارسال ایمیل سرور درست است.")
        except emails.EmailNotSent as e:
            raise CommandError(f"Sending failed: {e.__cause__!r}") from e
        self.stdout.write(self.style.SUCCESS(f"Sent to {to}."))
