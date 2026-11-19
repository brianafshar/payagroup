#!/usr/bin/env bash
# Start command on Render (render.yaml). Free instances have no shell, so setup happens here:
# migrations, the demo data on an empty database (SEED_DEMO=true), the first admin from
# DJANGO_SUPERUSER_EMAIL / _PASSWORD / _NAME, then the ASGI server (HTTP + chat WebSocket).
set -euo pipefail
python manage.py migrate --noinput
if [ "${SEED_DEMO:-false}" = "true" ]; then
  python manage.py shell -c "import sys; from django.contrib.auth import get_user_model as U; sys.exit(0 if U().objects.exists() else 1)" \
    || python manage.py seed_demo --force
fi
if [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
  python manage.py createsuperuser --noinput >/dev/null 2>&1 || true  # already exists → keep it
fi
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
