"""First-run setup of a gym install: the platform admin and the head coach (سرمربی), idempotent.

    python manage.py bootstrap_gym [--admin-user admin] [--admin-password …] [--head-user sarmoalem] [--head-password …]

Missing passwords are generated. Prints one JSON line with what was created (nothing if all existed)."""

import json
import secrets

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from coaching.models import AccountStatus, Coach
from training import library

ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def make_password() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(10))


class Command(BaseCommand):
    help = "Create the admin and the head coach if the gym has none yet."

    def add_arguments(self, parser):
        parser.add_argument("--admin-user", default="admin")
        parser.add_argument("--admin-password", default="")
        parser.add_argument("--head-user", default="sarmoalem")
        parser.add_argument("--head-password", default="")
        parser.add_argument("--head-name", default="سرمربی")
        parser.add_argument("--brand", default="PAYA Group")

    @transaction.atomic
    def handle(self, *args, **o):
        out = {}
        if not User.objects.filter(role=User.Role.ADMIN).exists():
            pw = o["admin_password"] or make_password()
            User.objects.create_superuser(o["admin_user"], password=pw, name="مدیر سیستم", role=User.Role.ADMIN)
            out["admin"] = {"username": o["admin_user"], "password": pw}
        if not Coach.objects.filter(is_head=True).exists():
            pw = o["head_password"] or make_password()
            user = User.objects.create_user(o["head_user"], password=pw, name=o["head_name"], role=User.Role.COACH)
            coach = Coach.objects.create(user=user, app_name=o["brand"], is_head=True, status=AccountStatus.ACTIVE, primary="#FF9A1F")
            coach.activate()
            coach.save()
            library.install(coach)
            out["head_coach"] = {"username": o["head_user"], "password": pw}
        self.stdout.write(json.dumps({**out, "at": timezone.now().isoformat()}) if out else "{}")
