import io

import boto3
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from moto import mock_aws
from PIL import Image

pytestmark = pytest.mark.django_db


def png(name="photo.png", size=(8, 8)) -> SimpleUploadedFile:
    buf = io.BytesIO()
    Image.new("RGB", size, "orange").save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def test_profile_photo_local(api, athlete, settings):
    r = api.as_user(athlete.user).patch("/api/auth/me/", {"photo": png()}, format="multipart")
    assert r.status_code == 200 and r.json()["photo"].startswith("http://testserver/media/photos/")


def test_upload_type_and_size_limits(api, athlete, admin, coach, settings):
    bad = SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")
    assert api.as_user(athlete.user).patch("/api/auth/me/", {"photo": bad}, format="multipart").status_code == 400
    settings.MAX_LOGO_BYTES = 10
    r = api.as_user(admin).patch(f"/api/coaches/{coach.pk}/", {"logo": png("logo.png")}, format="multipart")
    assert r.status_code == 400 and "logo" in r.data


@mock_aws
def test_uploads_go_to_s3_with_signed_urls(api, athlete, settings):
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="baseline-media")
    settings.STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": "baseline-media",
                "region_name": "us-east-1",
                "location": "media",
                "querystring_auth": True,
                "file_overwrite": False,
                "signature_version": "s3v4",
            },
        },
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    r = api.as_user(athlete.user).patch("/api/auth/me/", {"photo": png()}, format="multipart")
    assert r.status_code == 200, r.data
    url = r.json()["photo"]
    assert "baseline-media" in url and "X-Amz-Signature=" in url
    keys = [o["Key"] for o in boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="baseline-media")["Contents"]]
    assert len(keys) == 1 and keys[0].startswith("media/photos/")


def test_coach_logo_upload_and_remove(api, admin, coach):
    r = api.as_user(admin).patch(f"/api/coaches/{coach.pk}/", {"logo": png("logo.png"), "primary": "#0F6B5B"}, format="multipart")
    assert r.status_code == 200 and "/media/logos/" in r.json()["branding"]["logoUrl"]
    r = api.patch(f"/api/coaches/{coach.pk}/", {"removeLogo": True})
    assert r.json()["branding"]["logoUrl"] is None


def test_exercise_with_video_multipart(api, coach):
    video = SimpleUploadedFile("clip.mp4", b"\x00\x00\x00\x18ftypmp42", content_type="video/mp4")
    data = {"name": "پرس سینه دست جمع", "cat": "chest", "equip": "barbell", "diff": "advanced", "metrics": ["ست", "تکرار"], "dur": "0:40", "video": video}
    r = api.as_user(coach.user).post("/api/exercises/", data, format="multipart")
    assert r.status_code == 201, r.data
    body = r.json()
    assert body["metrics"] == ["ست", "تکرار"] and body["hasVideo"] is True and body["videoSrc"].startswith("http://testserver/media/videos/")


def test_exercise_video_remove(api, coach, bench):
    video = SimpleUploadedFile("clip.mp4", b"\x00\x00\x00\x18ftypmp42", content_type="video/mp4")
    api.as_user(coach.user).patch(f"/api/exercises/{bench.pk}/", {"video": video}, format="multipart")
    r = api.patch(f"/api/exercises/{bench.pk}/", {"removeVideo": True})
    assert r.status_code == 200 and r.json()["hasVideo"] is False


def test_coach_documents_and_preferences(api, coach):
    api.as_user(coach.user)
    pdf = SimpleUploadedFile("cv.pdf", b"%PDF-1.4", content_type="application/pdf")
    r = api.post("/api/coach/documents/", {"kind": "resume", "file": pdf}, format="multipart")
    assert r.status_code == 201 and r.json()["name"] == "cv.pdf"
    pdf2 = SimpleUploadedFile("cv2.pdf", b"%PDF-1.4", content_type="application/pdf")
    api.post("/api/coach/documents/", {"kind": "resume", "file": pdf2}, format="multipart")
    assert [d["name"] for d in api.get("/api/coach/documents/").json()] == ["cv2.pdf"]  # replaced
    r = api.patch("/api/coach/profile/", {"preferences": {"city": "تهران", "specs": ["hyp"]}}, format="json")
    assert r.json()["preferences"] == {"city": "تهران", "specs": ["hyp"]}


def jpeg(name="photo.jpg", size=(4000, 3000)) -> SimpleUploadedFile:
    buf = io.BytesIO()
    Image.effect_noise(size, 60).convert("RGB").save(buf, "JPEG", quality=98)
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


def test_big_jpeg_and_jfif_photos_are_accepted_and_downscaled(api, athlete, coach):
    """#46: phone JPEGs over the old 5 MB limit and Windows `.jfif` files used to be refused."""
    from accounts.models import User

    big = jpeg()
    assert big.size > 5 * 1024 * 1024
    r = api.as_user(athlete.user).patch("/api/auth/me/", {"photo": big}, format="multipart")
    assert r.status_code == 200 and r.json()["photo"].endswith(".jpg")
    stored = User.objects.get(pk=athlete.user.pk).photo
    assert stored.size < 1024 * 1024 and max(Image.open(stored).size) == 1600
    r = api.as_user(coach.user).patch("/api/auth/me/", {"photo": jpeg("scan.jfif", (800, 600))}, format="multipart")
    assert r.status_code == 200 and r.json()["photo"].endswith(".jpg")


def test_chat_image_attachment(api, athlete, coach):
    r = api.as_user(coach.user).post("/api/messages/", {"athlete": athlete.pk, "text": "", "attachment": jpeg("form.jpeg", (2400, 1800))}, format="multipart")
    assert r.status_code == 201, r.data
    assert r.json()["attachment"].endswith(".jpg")


def test_chat_video_attachment(api, athlete, coach):
    """#82: the coach sends a video; the athlete gets its URL and the thread preview says it's a video."""
    clip = SimpleUploadedFile("drill.mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4096, content_type="video/mp4")
    r = api.as_user(coach.user).post("/api/messages/", {"athlete": athlete.pk, "text": "", "attachment": clip}, format="multipart")
    assert r.status_code == 201, r.data
    assert r.json()["attachment"].endswith(".mp4")
    msgs = api.as_user(athlete.user).get("/api/messages/").json()
    rows = msgs["results"] if isinstance(msgs, dict) else msgs
    assert rows[-1]["attachment"].endswith(".mp4")
    from messaging.models import Message, preview

    assert Message.objects.get().preview == "🎬 ویدیو"
    assert preview("", None, "attachments/x/form.jpg") == "📷 عکس"
    assert preview("", None, "attachments/x/plan.pdf") == "📎 فایل پیوست"
    assert preview("ببین", None, "a.mp4") == "ببین"


def test_chat_video_size_limit(api, athlete, coach, settings):
    settings.MAX_VIDEO_BYTES = 1024
    clip = SimpleUploadedFile("big.mov", b"\x00" * 2048, content_type="video/quicktime")
    r = api.as_user(coach.user).post("/api/messages/", {"athlete": athlete.pk, "text": "", "attachment": clip}, format="multipart")
    assert r.status_code == 400
