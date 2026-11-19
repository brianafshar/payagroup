#!/usr/bin/env bash
# Container start (deploy/docker-compose.yml): migrations, static files for the Django admin, the first
# admin from DJANGO_SUPERUSER_EMAIL / _PASSWORD / _NAME, the exercise library, then Daphne.
set -euo pipefail
# A command instead of the server, e.g. `docker compose run --rm api python manage.py webpush_keys`.
if [ "$#" -gt 0 ]; then exec "$@"; fi
python manage.py migrate --noinput
python manage.py collectstatic --noinput >/dev/null
if [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
  python manage.py createsuperuser --noinput >/dev/null 2>&1 || true  # already exists → keep it
fi
if [ "${SEED_DEMO:-false}" = "true" ]; then
  python manage.py shell -c "import sys; from django.contrib.auth import get_user_model as U; sys.exit(0 if U().objects.filter(role='coach').exists() else 1)" \
    || python manage.py seed_demo --force
fi
exec daphne -b 0.0.0.0 -p 8000 --proxy-headers config.asgi:application
