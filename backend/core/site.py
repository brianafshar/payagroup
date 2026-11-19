"""The gym's own site (payagroup.org). It does not exist yet, so everything here is pluggable:

- `exercise_url(exercise)` is deterministic, so every exercise (library, new or uploaded) already has its
  link; the site's training section will serve it later.
- `publish_pdf(...)` hands a program PDF to the site's API (`SITE_API_URL`) and returns the public URL. Without
  it the PDF is kept on this server and served from `/api/shared-pdf/<token>/` (fine for testing only: an
  athlete's phone cannot reach the gym PC).
"""

import json
import urllib.request

from django.conf import settings
from django.urls import reverse


def exercise_url(exercise) -> str:
    key = exercise.library_key or f"x{exercise.pk}"
    return f"{settings.SITE_URL}/training/{key}"


class SiteError(Exception):
    pass


def publish_pdf(*, token: str, filename: str, data: bytes, base_url: str = "") -> str:
    """Public URL of the PDF."""
    if not settings.SITE_API_URL:
        return base_url.rstrip("/") + reverse("shared-pdf", args=[token])
    boundary = "----paya" + token[:16]
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n{token}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{settings.SITE_API_URL}/pdfs",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "X-Api-Key": settings.SITE_API_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310
            return json.loads(r.read())["url"]
    except Exception as e:  # network, bad JSON, missing key
        raise SiteError(str(e)) from e
