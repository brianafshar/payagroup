"""The standard exercise library (#39, #48, v2): 663 bodybuilding, band, corrective, running, cycling,
swimming and mobility exercises with steps, tips, muscles and band / no-equipment alternatives, and
illustrations (RepDB, start and end pose, downloaded on install) or bundled photos as a fallback,
installed into a coach's own library. Photos are stored once under `library/` in media storage and
shared by every coach (`Exercise.stock_image`); a coach's own photo or video replaces them per exercise."""

import json
import urllib.error
import urllib.request
from functools import cache
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .models import Exercise

DIR = Path(__file__).parent / "library"


@cache
def entries() -> list[dict]:
    return json.loads((DIR / "exercises.json").read_text(encoding="utf-8"))  # Windows defaults to cp1252


def _stock(image: str | None) -> str:
    """Storage path of a bundled library photo, uploaded the first time it's needed ("" if none)."""
    if not image:
        return ""
    path = f"library/{image}"
    if not default_storage.exists(path):
        with open(DIR / "images" / image, "rb") as f:
            path = default_storage.save(path, File(f))
    return path


_failed: set[str] = set()


def _pose(slug: str, pose: str) -> str:
    """Storage path of one illustrated pose (flat style, one consistent character) from RepDB's free
    tier, downloaded once. Their licence allows in-app use with attribution but not redistributing the
    images, so they aren't in this repo. "" when unavailable (offline, blocked, turned off)."""
    key = f"{slug}-{pose}"
    if not settings.EXERCISE_ILLUSTRATIONS or key in _failed:
        return ""
    path = f"library/illustrations/{key}.webp"
    if default_storage.exists(path):
        return path
    url = settings.EXERCISE_ILLUSTRATION_URL.format(id=slug, pose=pose)
    try:
        with urllib.request.urlopen(url, timeout=15) as res:  # noqa: S310 - configured https URL
            data = res.read()
    except (urllib.error.URLError, TimeoutError, OSError):
        data = b""
    if data[:4] == b"RIFF":  # a WebP image, not an error page
        return default_storage.save(path, ContentFile(data))
    _failed.add(key)
    return ""


def _illustration(row: dict) -> tuple[str, str]:
    """(end pose, start pose) of the row's illustration: two frames for `["start", "peak"]`, one for
    `["main"]`; ("", "") when it has none or it couldn't be downloaded."""
    slug, poses = row.get("illustration"), row.get("illustration_poses") or []
    if not slug or not poses:
        return "", ""
    if "peak" in poses:
        peak = _pose(slug, "peak")
        return (peak, _pose(slug, "start") if peak and "start" in poses else "")
    return _pose(slug, poses[0]), ""


BAND, BAND_METRIC = "band", "شدت کش"


def _is_library(path: str) -> bool:
    return path.startswith("library/")


def _details(row: dict) -> dict:
    alternatives = dict(row.get("alternatives") or {})
    if row.get("replaces"):
        alternatives["replaces"] = row["replaces"]
    return {
        "description": row["description"],
        "cues": row.get("tips") or [],
        "steps": row.get("steps") or [],
        "muscles_primary": row.get("muscles_primary") or [],
        "muscles_secondary": row.get("muscles_secondary") or [],
        "issues": row.get("issues") or [],
        "library_key": row.get("key", ""),
        "badge": row.get("badge") or "",
        "illustration_match": row.get("illustration_match") or "",
        "alternatives": alternatives,
    }


def install(coach) -> int:
    """Adds the library exercises the coach doesn't have yet (by name). For same-named exercises they
    already have it only fills what's empty (description, steps, tips, muscles…) and fixes the library
    picture: a corrected illustration replaces the old one, and one the library dropped goes back to the
    photo. A coach's own picture or video is never touched. Returns how many were added."""
    have = {e.name: e for e in Exercise.objects.filter(coach=coach)}
    new = []
    for row in entries():
        peak, start = _illustration(row)
        photo = _stock(row.get("image"))
        old = have.get(row["name"])
        if old is not None:
            details = _details(row)
            changed = [k for k, v in details.items() if v and not getattr(old, k)]
            for k in changed:
                setattr(old, k, details[k])
            if not old.image:
                if not row.get("illustration"):
                    # The library no longer pairs this exercise with an illustration (it was the wrong one).
                    target = (photo, "") if "/illustrations/" in old.stock_image or not old.stock_image else None
                elif peak:
                    target = (peak, start) if not old.stock_image or _is_library(old.stock_image) else None
                else:  # offline: only fill an empty picture
                    target = (photo, "") if not old.stock_image else None
                if target and (old.stock_image, old.stock_image_start) != target:
                    old.stock_image, old.stock_image_start = target
                    changed += ["stock_image", "stock_image_start"]
            if changed:
                old.save(update_fields=changed)
            continue
        new.append(
            Exercise(
                coach=coach,
                name=row["name"],
                sport=row["sport"],
                category=row["category"],
                equipment=row["equipment"],
                difficulty=row["difficulty"],
                measure=row["measure"],
                # Band work is prescribed and logged as a band level (1 yellow … 5 black), not kilos.
                unit=BAND if BAND_METRIC in row["metrics"] else row["unit"],
                metrics=row["metrics"],
                stock_image=peak or photo,
                stock_image_start=start if peak else "",
                **_details(row),
            )
        )
    Exercise.objects.bulk_create(new)
    return len(new)
