"""Upload paths and size/type validators (limits from the design, configured in settings)."""

import io
import os
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

# .jfif is how Windows often saves JPEGs; .gif/.bmp are converted like the rest.
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".bmp", ".svg"}
RASTER_EXTS = IMAGE_EXTS - {".svg"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}
# Voice messages: phones record .m4a (AAC), browsers .webm (Opus) or .mp4/.m4a (Safari).
AUDIO_EXTS = {".m4a", ".aac", ".mp3", ".ogg", ".oga", ".opus", ".wav", ".weba", ".webm", ".mp4", ".3gp", ".caf"}


def _path(folder: str, filename: str) -> str:
    return f"{folder}/{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()}"


def photo_upload_to(instance, filename):
    return _path("photos", filename)


def logo_upload_to(instance, filename):
    return _path("logos", filename)


def video_upload_to(instance, filename):
    return _path("videos", filename)


def image_upload_to(instance, filename):
    return _path("images", filename)


def document_upload_to(instance, filename):
    return _path("documents", filename)


def attachment_upload_to(instance, filename):
    return _path("attachments", filename)


def _check(f, exts: set[str], max_bytes: int, label: str) -> None:
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in exts:
        raise ValidationError(f"{label}: allowed types are {', '.join(sorted(exts))}.")
    if f.size > max_bytes:
        raise ValidationError(f"{label}: maximum size is {max_bytes // (1024 * 1024)} MB.")


def validate_logo(f):
    _check(f, IMAGE_EXTS, settings.MAX_LOGO_BYTES, "Logo")


def validate_photo(f):
    _check(f, IMAGE_EXTS - {".svg"}, settings.MAX_PHOTO_BYTES, "Photo")


def validate_video(f):
    _check(f, VIDEO_EXTS, settings.MAX_VIDEO_BYTES, "Video")


def validate_attachment(f):
    ext = os.path.splitext(f.name)[1].lower()
    limit = settings.MAX_VIDEO_BYTES if ext in VIDEO_EXTS else settings.MAX_ATTACHMENT_BYTES
    _check(f, RASTER_EXTS | VIDEO_EXTS | AUDIO_EXTS | {".pdf"}, limit, "Attachment")


def shrink_image(instance, field: str, max_side: int = 1600) -> None:
    """Newly uploaded photos are downscaled to `max_side` px, turned upright (EXIF) and re-encoded
    (JPEG, or PNG when transparent), so a 12 MB phone photo is stored as a few hundred KB.
    Animated GIFs, SVGs, videos and PDFs are left alone; anything Pillow can't read is kept as is."""
    from PIL import Image, ImageOps

    f = getattr(instance, field)
    if not f or getattr(f, "_committed", True):
        return
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in RASTER_EXTS:
        return
    try:
        f.seek(0)
        im = Image.open(f)
        if getattr(im, "is_animated", False):
            return
        im = ImageOps.exif_transpose(im)
        im.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        if alpha:
            im.save(buf, "PNG", optimize=True)
            new_ext = ".png"
        else:
            im.convert("RGB").save(buf, "JPEG", quality=85, optimize=True, progressive=True)
            new_ext = ".jpg"
    except Exception:  # noqa: BLE001 - not an image Pillow understands: store it unchanged
        f.seek(0)
        return
    name = os.path.splitext(os.path.basename(f.name))[0] + new_ext
    setattr(instance, field, ContentFile(buf.getvalue(), name=name))


def validate_document(f):
    _check(f, {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"}, 10 * 1024 * 1024, "Document")
