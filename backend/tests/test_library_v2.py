"""Exercise library v2: 663 exercises with steps, tips, muscles, corrective issues, band / no-equipment
alternatives and two-frame illustrations; re-installing fixes wrong library pictures but never the
coach's own."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from training import library
from training.models import Exercise

from .conftest import Api

pytestmark = pytest.mark.django_db


@pytest.fixture
def online(settings, monkeypatch):
    """Every RepDB pose downloads (a tiny WebP); records the URLs asked for."""
    calls: list[str] = []

    def fake_urlopen(url, timeout=0):
        calls.append(url)
        return io.BytesIO(b"RIFF....WEBPVP8 ")

    settings.EXERCISE_ILLUSTRATIONS = True
    library._failed.clear()
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    return calls


def test_fresh_coach_gets_the_whole_library_with_details(coach):
    assert library.install(coach) == 695
    squat = Exercise.objects.get(coach=coach, name="اسکوات هالتر")
    assert squat.library_key == "squat" and len(squat.steps) >= 3 and squat.cues and squat.muscles_primary
    assert squat.alternatives["band"] == ["band-squat", "banded-squat"]
    band = Exercise.objects.get(coach=coach, name="پرس سینه ایستاده با کش")
    assert band.badge == "band" and band.illustration_match == "approx" and "bench-press" in band.alternatives["replaces"]
    assert Exercise.objects.filter(coach=coach, category="corrective").exists()
    assert sum("rounded_shoulders" in e.issues for e in Exercise.objects.filter(coach=coach)) >= 3
    assert library.install(coach) == 0  # idempotent


def test_api_resolves_alternatives_to_the_coachs_exercises(coach):
    library.install(coach)
    squat = Exercise.objects.get(coach=coach, name="اسکوات هالتر")
    data = Api().as_user(coach.user).get(f"/api/exercises/{squat.pk}/").json()
    band_ids = {str(e.pk) for e in Exercise.objects.filter(coach=coach, library_key__in=["band-squat", "banded-squat"])}
    assert set(data["alternatives"]["band"]) == band_ids and data["alternatives"]["home"]
    assert data["steps"] == squat.steps and data["cues"] == squat.cues and data["musclesPrimary"] == squat.muscles_primary
    assert data["imageStartSrc"] is None  # offline: photo only


def test_old_coach_only_gets_new_exercises_and_empty_details_filled(coach):
    """A coach from v1: the 150 old exercises exist (some edited); only the 513 new ones are added."""
    old_names = {"اسکوات هالتر": "توضیح خود مربی", "پرس سینه هالتر": ""}
    for name, desc in old_names.items():
        Exercise.objects.create(coach=coach, name=name, category="legs", equipment="barbell", description=desc)
    assert library.install(coach) == 693
    squat = Exercise.objects.get(coach=coach, name="اسکوات هالتر")
    assert squat.description == "توضیح خود مربی"  # the coach's text is kept
    assert squat.steps and squat.library_key == "squat"  # empty fields are filled
    assert Exercise.objects.get(coach=coach, name="پرس سینه هالتر").description  # empty → library text


def test_two_frames_wrong_picture_fixed_dropped_picture_back_to_photo(coach, online):
    clean = Exercise.objects.create(coach=coach, name="پاور کلین", category="power", equipment="barbell", stock_image="library/illustrations/power-clean.webp")
    chest_pass = Exercise.objects.create(
        coach=coach, name="پاس سینه توپ طبی", category="power", equipment="ball", stock_image="library/illustrations/medicine-ball-slam.webp"
    )
    own = Exercise.objects.create(
        coach=coach, name="پرس سرشانه هالتر ایستاده", category="shoulders", equipment="barbell", stock_image="library/illustrations/x.webp"
    )
    own.image = SimpleUploadedFile("mine.png", b"x")
    own.save()
    library.install(coach)
    clean.refresh_from_db()
    chest_pass.refresh_from_db()
    own.refresh_from_db()
    # wrong old illustration → the corrected one, both frames
    assert clean.stock_image == "library/illustrations/clean-peak.webp" and clean.stock_image_start == "library/illustrations/clean-start.webp"
    # the library dropped its (wrong) illustration → back to the photo
    assert chest_pass.stock_image == "library/medicine_ball_chest_pass.jpg" and chest_pass.stock_image_start == ""
    # the coach's own picture wins; nothing about it changes
    assert own.image.name.endswith(".png") and own.stock_image == "library/illustrations/x.webp"
    data = Api().as_user(coach.user).get(f"/api/exercises/{clean.pk}/").json()
    assert data["imageSrc"].endswith("clean-peak.webp") and data["imageStartSrc"].endswith("clean-start.webp")
    assert Api().as_user(coach.user).get(f"/api/exercises/{own.pk}/").json()["imageStartSrc"] is None


def test_single_frame_and_offline_keep_existing(coach, online, settings):
    library.install(coach)
    one = Exercise.objects.get(coach=coach, name="کشش سینه با کش")  # ["main"]
    assert one.stock_image == "library/illustrations/banded-chest-stretch-main.webp" and one.stock_image_start == ""
    # going offline later never downgrades an illustration to a photo
    settings.EXERCISE_ILLUSTRATIONS = False
    library.install(coach)
    squat = Exercise.objects.get(coach=coach, name="اسکوات هالتر")
    assert squat.stock_image.endswith("squat-peak.webp")


def test_band_exercises_log_a_band_level_not_kilos(coach, athlete):
    from django.utils import timezone

    from training import services
    from training.models import PersonalRecord, Program

    library.install(coach)
    band = Exercise.objects.get(coach=coach, name="پول‌اپارت با کش")
    assert band.unit == "band"
    day = {"weekday": "sat", "focus": "کش", "rest": False, "exercises": [{"exercise_id": band.pk, "sets": [{"reps": "12", "value": 2, "unit": "band"}] * 2}]}
    days = [dict(day, weekday=w) for w in ("sat", "sun", "mon", "tue", "wed", "thu", "fri")]
    tpl = Program.objects.create(coach=coach, name="کش", duration_weeks=4, weeks=[{"index": 1, "days": days}])
    services.assign(tpl, [athlete], timezone.localdate())
    athlete.refresh_from_db()
    log = services.start_workout(athlete, timezone.localdate())
    first, second = log.sets.order_by("index")
    services.log_set(first, done=True)
    services.log_set(second, done=True, actual_value=3, actual_reps="10")
    assert not PersonalRecord.objects.filter(athlete=athlete).exists()  # no «kg» records from band levels
    log.refresh_from_db()
    assert log.volume_kg == 0
    data = Api().as_user(coach.user).get(f"/api/athletes/{athlete.pk}/analytics/", {"section": "strength"}).json()
    [b] = data["bands"]
    assert b["name"] == "پول‌اپارت با کش" and b["current"]["level"] == 3 and b["current"]["reps"] == 10


def test_athlete_schedule_has_exercise_pictures(coach, athlete, online):
    from django.utils import timezone

    from training import services
    from training.models import Program

    library.install(coach)
    squat = Exercise.objects.get(coach=coach, name="اسکوات هالتر")
    days = [
        {"weekday": w, "focus": "پا", "rest": False, "exercises": [{"exercise_id": squat.pk, "sets": [{"reps": "8", "value": 80, "unit": "kg"}]}]}
        for w in ("sat", "sun", "mon", "tue", "wed", "thu", "fri")
    ]
    services.assign(Program.objects.create(coach=coach, name="پا", duration_weeks=4, weeks=[{"index": 1, "days": days}]), [athlete], timezone.localdate())
    [day] = [d for d in Api().as_user(athlete.user).get("/api/me/schedule/").json()["days"] if d["today"]]
    ex = day["exercises"][0]
    assert ex["imageSrc"].endswith("squat-peak.webp") and ex["imageStartSrc"].endswith("squat-start.webp")


def test_renamed_library_exercise_renames_the_coachs_copy(coach):
    old = Exercise.objects.create(coach=coach, name="ابداکشن ران خوابیده به پهلو", category="legs", equipment="bodyweight")
    library.install(coach)
    old.refresh_from_db()
    assert old.name == "ساید لایینگ هیپ ابداکشن"
    assert Exercise.objects.filter(coach=coach, name="ابداکشن ران خوابیده به پهلو").count() == 0
    assert Exercise.objects.filter(coach=coach, sport="basketball").count() >= 30
