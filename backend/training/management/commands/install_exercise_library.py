"""`python manage.py install_exercise_library [--coach EMAIL]` — adds the standard library to every
coach (or one). Safe to re-run: existing exercises (same name) are kept and only get a missing photo."""

from django.core.management.base import BaseCommand, CommandError

from coaching.models import Coach
from training import library


class Command(BaseCommand):
    help = "Install the standard exercise library (with photos) into coaches' libraries."

    def add_arguments(self, parser):
        parser.add_argument("--coach", help="Only this coach (login email).")

    def handle(self, coach=None, **opts):
        coaches = Coach.objects.select_related("user")
        if coach:
            coaches = coaches.filter(user__email=coach.lower())
            if not coaches:
                raise CommandError(f"No coach with email {coach}.")
        for c in coaches:
            n = library.install(c)
            self.stdout.write(f"{c.user.email}: {n} exercises added")
