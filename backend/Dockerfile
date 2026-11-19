# The indow API (Django + Daphne: HTTP and the chat WebSocket). Built by deploy/docker-compose.yml.
FROM python:3.12-slim

# Optional PyPI mirror for servers where pypi.org is slow or blocked (e.g. https://<mirror>/simple).
ARG PIP_INDEX_URL=
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1

# Pango/HarfBuzz for WeasyPrint (the program PDF); the Vazirmatn fonts ship in core/pdf/fonts.
# Optional Debian mirror (base URL that serves /debian and /debian-security, e.g. https://<mirror>).
ARG APT_MIRROR=
RUN if [ -n "$APT_MIRROR" ]; then sed -i "s|http://deb.debian.org|${APT_MIRROR%/}|g" /etc/apt/sources.list.d/debian.sources; fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libharfbuzz-subset0 fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN if [ -n "$PIP_INDEX_URL" ]; then export PIP_INDEX_URL; fi; pip install -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
