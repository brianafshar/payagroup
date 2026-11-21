"""The gym's own site (payagroup.org). It does not exist yet, so everything here is pluggable:

- `exercise_url(exercise)` is deterministic, so every exercise (library, new or uploaded) already has its
  link; the site's training section will serve it later.
- `publish_pdf(...)` hands a program PDF to the site's API (`SITE_API_URL`) and returns the public URL. Without
  it the PDF is kept on this server and served from `/api/shared-pdf/<token>/` (fine for testing only: an
  athlete's phone cannot reach the gym PC).
"""

import json
import logging
import mimetypes
import threading
import urllib.request
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from django.urls import reverse
from django.utils import timezone


def exercise_url(exercise) -> str:
    """The exercise's tutorial page on the site; the site addresses exercises by this app's exercise id."""
    return f"{settings.SITE_URL}/fa/exercises/{exercise.pk}"


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


log = logging.getLogger(__name__)


def _multipart(fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> tuple[bytes, str]:
    boundary = "----paya" + uuid.uuid4().hex
    parts: list[bytes] = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    for k, (name, data, ctype) in files.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _read(field) -> tuple[str, bytes, str] | None:
    """A stored file as (name, bytes, content type), or None when it is missing."""
    try:
        with default_storage.open(field if isinstance(field, str) else field.name, "rb") as f:
            name = (field if isinstance(field, str) else field.name).rsplit("/", 1)[-1]
            return name, f.read(), mimetypes.guess_type(name)[0] or "application/octet-stream"
    except Exception:
        return None


def exercise_payload(ex) -> dict:
    """The exercise in the shape of the site's public API (docs/SITE-SYNC.md)."""
    return {
        "id": ex.pk,
        "name": ex.name,
        "description": ex.description,
        "category": ex.category,
        "sport": ex.sport or "fitness",
        "equipment": ex.equipment,
        "difficulty": ex.difficulty,
        "duration": ex.duration,
        "video_url": ex.video_url,
        "steps": list(ex.steps or []),
        "tips": [c if isinstance(c, str) else c.get("text", "") for c in (ex.cues or [])],
        "muscles_primary": list(ex.muscles_primary or []),
        "muscles_secondary": list(ex.muscles_secondary or []),
    }


def has_video(ex) -> bool:
    return bool(ex.video or ex.video_url)


def sync_exercise(ex) -> str:
    """Send an exercise with a video to the site (`PUT {SITE_API_URL}/exercises/{id}`, multipart: `data` JSON,
    `video`, `image`). Returns `synced` · `skipped` (no site / no video) · `failed`; the outcome is saved on the
    exercise. Never raises."""
    from training.models import Exercise

    if not settings.SITE_API_URL or not has_video(ex):
        return "skipped"
    files = {}
    if ex.video:
        v = _read(ex.video)
        if v:
            files["video"] = v
    img = _read(ex.image) if ex.image else (_read(ex.stock_image) if ex.stock_image else None)
    if img:
        files["image"] = img
    status, error = "synced", ""
    try:
        body, ctype = _multipart({"data": json.dumps(exercise_payload(ex), ensure_ascii=False)}, files)
        req = urllib.request.Request(
            f"{settings.SITE_API_URL}/exercises/{ex.pk}", data=body, method="PUT", headers={"Content-Type": ctype, "X-Api-Key": settings.SITE_API_KEY}
        )
        with urllib.request.urlopen(req, timeout=300) as r:  # noqa: S310
            r.read()
    except Exception as e:
        status, error = "failed", str(e)[:200]
        log.warning("Site sync of exercise %s failed: %s", ex.pk, e)
    Exercise.objects.filter(pk=ex.pk).update(site_synced_at=timezone.now() if status == "synced" else None, site_error=error)
    return status


def remove_exercise(pk: int) -> None:
    """Take an exercise off the site (best effort)."""
    if not settings.SITE_API_URL:
        return
    req = urllib.request.Request(f"{settings.SITE_API_URL}/exercises/{pk}", method="DELETE", headers={"X-Api-Key": settings.SITE_API_KEY})
    try:
        urllib.request.urlopen(req, timeout=20).read()  # noqa: S310
    except Exception as e:
        log.warning("Site removal of exercise %s failed: %s", pk, e)


def sync_in_background(pk: int) -> None:
    """After a library save: push the exercise without making the coach wait for the upload."""
    if not settings.SITE_API_URL:
        return

    def run():
        from training.models import Exercise

        ex = Exercise.objects.filter(pk=pk).first()
        if ex:
            sync_exercise(ex)

    threading.Thread(target=run, daemon=True).start()
