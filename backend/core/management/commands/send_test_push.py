"""`python manage.py send_test_push athlete@example.com` — shows the push setup and sends a test
notification to every device that user signed in on (synchronously, so errors show here)."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from messaging import push
from messaging.models import Device


class Command(BaseCommand):
    help = "Send a test push notification to a user's registered devices."

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, email, **opts):
        kind = push.backend()
        target = {"expo": push.EXPO_URL, "webhook": settings.PUSH_WEBHOOK_URL or "(PUSH_WEBHOOK_URL not set)"}.get(kind, "-")
        self.stdout.write(f"backend={kind} target={target}")
        if kind == "off":
            self.stdout.write(self.style.WARNING("Push is off (PUSH_BACKEND=off). The app still shows notifications in-app."))
            return
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user {email}.")
        tokens = list(Device.objects.filter(user=user).values_list("token", flat=True))
        self.stdout.write(f"devices={len(tokens)}")
        if not tokens:
            self.stdout.write(
                self.style.WARNING(
                    "No device registered. The app registers after sign-in only in a development/store build "
                    "with an EAS project id (not in Expo Go or on the web)."
                )
            )
            return
        if kind == "expo":
            try:
                res = push._post([{"to": t, "title": "indow", "body": "اعلان آزمایشی", "sound": "default"} for t in tokens])
            except Exception as e:  # noqa: BLE001
                raise CommandError(f"Expo push failed: {e!r} — Expo blocks sanctioned regions; try a server abroad or PUSH_BACKEND=webhook.") from e
            self.stdout.write(str(res))
        else:
            push.send(tokens, "indow", "اعلان آزمایشی", {"type": "test"})
        self.stdout.write(self.style.SUCCESS("Done."))
