"""Demo data mirroring the designs: admins, coach workspaces, the Ali Fitness library and programs, and
athletes with months of history — «علی رستمی» most of all: a 16-week base block before his current
program (logs, PRs, cardio), nutrition, 45 days of check-ins, biweekly measurements, field tests and
chat. Everything the panels and the app show comes from here; nothing is hardcoded in the clients."""

import random
from datetime import date, time, timedelta

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from coaching.models import Athlete, Coach, HealthProfile, TestDefinition
from core.models import PlatformSettings
from messaging.models import Message
from tracking.models import FoodItem, Meal, MealLog, Measurement, NutritionPlan, RecoveryCheckIn, RecoveryPlan, TestResult, WaterLog
from training import services
from training.models import PY_WEEKDAY, WEEKDAYS, Exercise, LoggedSet, PersonalRecord, Program, WorkoutLog

DEMO_PASSWORD = "baseline-demo"

COACHES = [
    # email, name, app, theme, primary, sport, status, cap, validity days, days until expiry (None = not activated)
    ("ali@alifitness.app", "علی احمدی", "Ali Fitness", "ali-fitness", "#0F6B5B", "fitness", "active", 50, 90, 42),
    ("mina@northline.app", "مینا شریعتی", "Northline Endurance", "northline", "#8E1B3A", "endurance", "active", None, None, None),
    ("kaveh@kova.app", "کاوه نیک‌پور", "Kova Athletics", "kova", "#F5C400", "fitness", "draft", 30, 90, None),
    ("arash@apex.app", "آرش عبادی", "Apex Coaching", "", "#FF9A1F", "fitness", "active", 40, 60, 2),
    ("shirin@stridelab.app", "شیرین رحیمی", "StrideLab", "", "#FF9A1F", "endurance", "active", 25, 30, -3),
    ("nasrin@corestudio.app", "نسرین کمالی", "Core Studio", "", "#FF9A1F", "fitness", "invited", 20, 90, None),
]

EXERCISES = [
    # key, name, cat, equip, difficulty, video duration, metrics
    ("bench", "پرس سینه هالتر", "chest", "barbell", "intermediate", "0:42", ["ست", "تکرار", "وزنه", "استراحت", "RPE"]),
    ("incline", "پرس بالاسینه دمبل", "chest", "dumbbell", "intermediate", "0:38", ["ست", "تکرار", "وزنه", "استراحت"]),
    ("fly", "قفسه سینه کابل", "chest", "cable", "beginner", "", ["ست", "تکرار", "وزنه", "استراحت"]),
    ("pushup", "شنا سوئدی", "chest", "bodyweight", "beginner", "0:20", ["ست", "تکرار"]),
    ("squat", "اسکوات هالتر", "legs", "barbell", "advanced", "1:05", ["ست", "تکرار", "وزنه", "استراحت", "RPE"]),
    ("rdl", "ددلیفت رومانیایی", "legs", "barbell", "intermediate", "0:51", ["ست", "تکرار", "وزنه", "RPE"]),
    ("lunge", "لانج راه‌رفتنی", "legs", "dumbbell", "beginner", "", ["ست", "تکرار", "وزنه"]),
    ("lat", "لت پول‌داون", "back", "cable", "beginner", "", ["ست", "تکرار", "وزنه", "استراحت"]),
    ("row", "زیربغل دمبل تک‌دست", "back", "dumbbell", "beginner", "0:33", ["ست", "تکرار", "وزنه"]),
    ("pullup", "بارفیکس", "back", "bodyweight", "advanced", "0:27", ["ست", "تکرار", "وزنه اضافه"]),
    ("pushdown", "پشت بازو سیم‌کش", "arms", "cable", "beginner", "0:29", ["ست", "تکرار", "وزنه"]),
    ("curl", "جلو بازو دمبل", "arms", "dumbbell", "beginner", "0:25", ["ست", "تکرار", "وزنه"]),
    ("ohp", "پرس سرشانه دمبل", "shoulders", "dumbbell", "intermediate", "0:36", ["ست", "تکرار", "وزنه", "استراحت"]),
    ("lateral", "نشر جانب دمبل", "shoulders", "dumbbell", "beginner", "", ["ست", "تکرار", "وزنه"]),
    ("treadmill", "اینتروال تردمیل", "conditioning", "machine", "intermediate", "", ["مدت", "مسافت", "ضربان قلب", "RPE"]),
    ("boxjump", "پرش روی جعبه", "power", "box", "intermediate", "0:24", ["ست", "تکرار", "ارتفاع"]),
]
CUES = {
    "bench": ["کتف‌ها را جمع و به نیمکت بچسبان", "میله را تا وسط سینه پایین بیاور", "پاها محکم روی زمین"],
    "incline": ["شیب نیمکت ۳۰ درجه", "آرنج‌ها ۴۵ درجه از بدن", "پایین آوردن کنترل‌شده، ۲ ثانیه"],
    "pushdown": ["آرنج‌ها کنار بدن ثابت", "در پایین حرکت یک ثانیه مکث", "بالا آوردن کنترل‌شده"],
}

# weekday → (focus, [(exercise, sets, reps, start kg, rest s)])
PLAN = {
    "sat": ("سینه + پشت بازو", [("bench", 4, "8", 60, 90), ("incline", 4, "10", 22, 75), ("fly", 3, "12", 15, 60), ("pushdown", 4, "12", 25, 60)]),
    "sun": ("پشت + جلو بازو", [("lat", 4, "10", 55, 75), ("row", 4, "10", 26, 75), ("curl", 3, "12", 12, 60)]),
    "mon": ("پا", [("squat", 4, "8", 80, 120), ("rdl", 3, "10", 70, 90), ("lunge", 3, "12", 16, 60)]),
    "wed": ("سرشانه", [("ohp", 4, "10", 18, 75), ("lateral", 3, "15", 8, 45)]),
    "thu": ("تمام بدن", [("bench", 3, "8", 60, 90), ("squat", 3, "8", 80, 120), ("row", 3, "10", 26, 75)]),
}

ATHLETES = [
    ("reza.karimi@mail.com", "رضا کریمی", "str", "m"),
    ("amir.hosseini@mail.com", "امیر حسینی", "gain", "m"),
    ("sara.moradi@mail.com", "سارا مرادی", "loss", "f"),
    ("neda.jafari@mail.com", "ندا جعفری", "gen", "f"),
    ("hamid.rezaei@mail.com", "حمید رضایی", "gain", "m"),
]

# name, time, [(food, grams, kcal, protein, carbs, fat per 100 g)]
MEALS = [
    ("صبحانه", time(7, 30), [("تخم‌مرغ", 150, 155, 13, 1.1, 11), ("نان سبوس‌دار", 80, 250, 9, 45, 3.5), ("شیر کم‌چرب", 250, 50, 3.4, 5, 1.5)]),
    ("ناهار", time(13, 0), [("سینه مرغ", 200, 165, 31, 0, 3.6), ("برنج پخته", 200, 130, 2.7, 28, 0.3), ("سالاد با روغن زیتون", 150, 90, 1, 5, 7)]),
    ("میان‌وعده", time(16, 30), [("ماست یونانی", 200, 97, 9, 4, 5), ("موز", 120, 89, 1.1, 23, 0.3), ("آجیل", 30, 600, 20, 20, 50)]),
    ("شام", time(20, 30), [("ماهی سالمون", 180, 208, 20, 0, 13), ("سیب‌زمینی", 250, 87, 1.9, 20, 0.1), ("سبزیجات بخارپز", 150, 35, 2, 7, 0.3)]),
]


class Command(BaseCommand):
    help = f"Load demo data (every demo account's password is '{DEMO_PASSWORD}'). Development only."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Flush the database first.")
        parser.add_argument("--force", action="store_true", help="Allow running with DEBUG off.")

    def handle(self, *args, reset=False, force=False, **opts):
        if not settings.DEBUG and not force:
            raise CommandError("Refusing to seed demo data with DEBUG off (use --force).")
        if reset:
            call_command("flush", interactive=False, verbosity=0)
        if User.objects.filter(email="sina@baseline.app").exists():
            raise CommandError("Demo data already present (use --reset).")
        self.rng = random.Random(42)
        with transaction.atomic():
            self.seed()
        # Every coach also gets the standard exercise library with photos (the seeded ones get photos too).
        from training import library

        for c in Coach.objects.all():
            library.install(c)
        self.stdout.write(self.style.SUCCESS("Demo data loaded. Password for every account: " + DEMO_PASSWORD))
        for label, email in [
            ("Super admin", "sina@baseline.app"),
            ("Support admin", "support@baseline.app"),
            ("Coach (Ali Fitness)", "ali@alifitness.app"),
            ("Athlete", "ali.rostami@gmail.com"),
        ]:
            self.stdout.write(f"  {label:<20} {email}")

    def user(self, email, name, role, **kw):
        return User.objects.create_user(email, DEMO_PASSWORD, name=name, role=role, **kw)

    def seed(self):
        now = timezone.now()
        self.user("sina@baseline.app", "سینا توکلی", "admin", admin_role="super", is_staff=True, is_superuser=True)
        self.user("support@baseline.app", "مریم پشتیبان", "admin", admin_role="support")
        # Demo convenience: don't force admins to set up an authenticator app (turn on in A08 › Security).
        PlatformSettings.objects.update_or_create(pk=1, defaults={"require_admin_2fa": False})

        coaches = {}
        for email, name, app, theme, primary, sport, status, cap, days, left in COACHES:
            u = self.user(email, name, "coach")
            if status in ("draft", "invited"):
                u.set_unusable_password()
                u.save()
            expires = now + timedelta(days=left) if left is not None else None
            activated = expires - timedelta(days=days) if expires and days else (now - timedelta(days=120) if status == "active" else None)
            coaches[email] = Coach.objects.create(
                user=u, app_name=app, theme=theme, primary=primary, sport=sport, status=status, athlete_cap=cap,
                validity_days=days, activated_at=activated, expires_at=expires, reminder_days=2,
            )  # fmt: skip
        Coach.objects.filter(user__email="nasrin@corestudio.app").update(created_at=now - timedelta(days=5))
        coach = coaches["ali@alifitness.app"]
        coach.bio = "مربی بدنسازی و قدرتی با ۱۰ سال سابقه."
        coach.save()

        ex = {}
        for key, name, cat, equip, diff, dur, metrics in EXERCISES:
            ex[key] = Exercise.objects.create(
                coach=coach, name=name, category=cat, equipment=equip, difficulty=diff, duration=dur, metrics=metrics, cues=CUES.get(key, []),
                unit="kg" if equip in ("barbell", "dumbbell", "cable") else "reps",
            )  # fmt: skip

        def build(n_weeks, load):
            """Program weeks from PLAN; `load(week, start_kg)` gives the prescribed kg."""
            weeks = []
            for w in range(1, n_weeks + 1):
                days = []
                for wd in WEEKDAYS:
                    if wd not in PLAN:
                        days.append({"weekday": wd, "focus": "", "rest": True, "exercises": []})
                        continue
                    focus, items = PLAN[wd]
                    slots = [
                        {"exercise_id": ex[k].pk, "note": "ست آخر را ۶۷٫۵ بزن اگر تکرارها تمیز بود." if k == "bench" and w == 4 and n_weeks == 8 else "",
                         "sets": [{"reps": reps, "value": load(w, kg), "unit": "kg", "rest_sec": rest, "rpe": None} for _ in range(n)]}
                        for k, n, reps, kg, rest in items
                    ]  # fmt: skip
                    days.append({"weekday": wd, "focus": focus, "rest": False, "exercises": slots})
                weeks.append({"index": w, "days": days})
            return weeks

        def plate(x):
            return round(x / 2.5) * 2.5 if x >= 20 else round(x)

        weeks = build(8, lambda w, kg: kg + (2.5 * ((w - 1) // 2) if kg >= 20 else 0))
        # The base block before it: 16 weeks building from ~78 % to the current loads.
        base = Program.objects.create(
            coach=coach, name="پایه ۱۶ هفته", goal="آمادگی عمومی", duration_weeks=16, sessions_per_week=5,
            weeks=build(16, lambda w, kg: plate(kg * (0.78 + 0.2 * (w - 1) / 15))),
        )  # fmt: skip
        base.sync_exercises()
        template = Program.objects.create(coach=coach, name="عضله‌سازی ۸ هفته", goal="عضله‌سازی", duration_weeks=8, sessions_per_week=5, weeks=weeks)
        template.sync_exercises()
        strength = Program.objects.create(coach=coach, name="قدرت پایه ۶ هفته", goal="قدرت", duration_weeks=6, sessions_per_week=3, weeks=weeks[:6])
        strength.sync_exercises()

        today = timezone.localdate()
        # Week 1 began on the Saturday three weeks back, so today falls in week 4 (as in the designs).
        start = today - timedelta(days=21 + WEEKDAYS.index(PY_WEEKDAY[today.weekday()]))
        ali_user = self.user("ali.rostami@gmail.com", "علی رستمی", "athlete", phone="09121234567")
        ali = Athlete.objects.create(
            coach=coach,
            user=ali_user,
            name="علی رستمی",
            email=ali_user.email,
            phone="09121234567",
            status="active",
            goal="gain",
            gender="m",
            birth_date=date(1999, 3, 14),
            sport="بدنسازی",
        )
        # 16-week base block, then the current program.
        self.block(ali, base, start - timedelta(weeks=16), start)
        services.assign(template, [ali], start)
        ali.refresh_from_db()
        ali.goal_weight_kg = 84
        ali.save(update_fields=["goal_weight_kg"])
        others = []
        for email, name, goal, gender in ATHLETES:
            u = self.user(email, name, "athlete")
            a = Athlete.objects.create(
                coach=coach,
                user=u,
                name=name,
                email=email,
                status="active",
                goal=goal,
                gender=gender,
                birth_date=date(1994 + len(others) * 2, 1 + len(others), 10),
            )
            others.append(a)
        for a in others[:3]:
            self.block(a, base, today - timedelta(days=10 + 7 * 8), today - timedelta(days=10), sparse=True)
        services.assign(strength, others[:3], today - timedelta(days=10))
        Athlete.objects.create(coach=coach, name="کیان تهرانی", email="kian.tehrani@mail.com", status="invited", goal="str")
        Athlete.objects.create(coach=coach, name="پریسا نوری", phone="09351234567", status="draft", goal="loss", gender="f")
        mina = coaches["mina@northline.app"]
        for email, name in [("tina.salehi@mail.com", "تینا صالحی"), ("leila.farahani@mail.com", "لیلا فراهانی")]:
            Athlete.objects.create(coach=mina, user=self.user(email, name, "athlete"), name=name, email=email, status="active", goal="gen", gender="f")

        self.history(ali, start, today)
        for a in others[:3]:
            self.history(a, a.program_start, today, sparse=True)
        self.cardio(ali, ex["treadmill"], today)
        # Tested maxes (coach-entered 1RM records) for the strength chart (C27).
        for key, tests in [("bench", [(84, 70), (40, 75), (12, 80)]), ("squat", [(84, 92.5), (40, 100), (12, 107.5)])]:
            prev = None
            for back, kg in tests:
                PersonalRecord.objects.create(
                    athlete=ali, exercise=ex[key], type="1RM", value=kg, unit="kg", date=today - timedelta(days=back), previous=prev, created_by=coach.user
                )
                prev = kg
        self.nutrition(ali, today)
        self.recovery(ali, today, days=45, sore_streak=True)
        self.measurements(ali, today)
        self.tests(coach, [ali, *others[:3]], today)
        RecoveryPlan.objects.create(
            athlete=ali, sleep_hours=8, stretch_min=15, rest_days=["fri"], note="جمعه استراحت کامل است. ۲۰ دقیقه پیاده‌روی اشکالی ندارد.",
            checks=[*RecoveryPlan.CHECKS, "rhr", "hrv", "sleep_score", "body_battery"],
            custom_fields=[{"key": "c_mood", "label": "حال و انگیزه", "kind": "scale", "unit": ""}],
        )  # fmt: skip
        coach.preferences = {"m": {"freq": "w2", "n": 6, "day": "fr", "remind": "morning", "req": ["w", "f", "wa"], "applyAll": False}}
        coach.save(update_fields=["preferences"])
        for i, a in enumerate(others):
            self.nutrition(a, today, days=7 if i < 3 else 3)
            self.recovery(a, today, days=21 if i < 3 else 5)
            self.measurements(a, today, scale=0.92 + i * 0.05)
        others[1].goal_weight_kg = 86
        others[1].save(update_fields=["goal_weight_kg"])

        HealthProfile.objects.create(
            athlete=ali, conditions="", injuries="گیرافتادگی شانه چپ (۱۴۰۳) · الان درد ندارد", medications="هیچ", allergies="",
            limitations="پرس پشت گردن ممنوع", history="آرتروسکوپی زانوی راست، ۱۳۹۸", updated_by=ali_user,
        )  # fmt: skip
        self.chat(ali, coach, now)
        self.threads(others, coach, now)

    def history(self, athlete, start, today, sparse=False):
        """Past sessions: mostly done as prescribed, a few heavier sets (→ PRs), some partial or missed."""
        d = start
        while d < today:
            s = services.session_for(athlete, d)
            if s["day"] and not s["day"].get("rest"):
                roll = self.rng.random()
                if roll < (0.25 if sparse else 0.08):
                    athlete.workouts.create(program=athlete.program, week=s["week"], weekday=s["weekday"], date=d, status="missed")
                else:
                    log = services.start_workout(athlete, d)
                    sets = list(log.sets.all())
                    cut = len(sets) - 3 if roll > 0.85 else len(sets)
                    for st in sets[:cut]:
                        heavier = st.target_value and st.unit == "kg" and st.index == 3 and self.rng.random() < 0.4
                        services.log_set(st, done=True, actual_value=st.target_value + 2.5 if heavier else None)
                    services.finish_workout(log, rpe=self.rng.choice([7, 8, 8, 9]), duration_min=self.rng.randint(52, 68))
            d += timedelta(days=1)

    def block(self, athlete, program, start, end, sparse=False):
        """A finished earlier program: assign it, log its sessions, then archive the copy."""
        (copy,) = services.assign(program, [athlete], start)
        self.history(athlete, start, end, sparse=sparse)
        copy.archived = True
        copy.save(update_fields=["archived"])

    def cardio(self, athlete, treadmill, today):
        """Friday interval sessions for the last 10 weeks (endurance analytics, C28)."""
        d = today - timedelta(days=(today.weekday() - 4) % 7 or 7)
        for i in range(10):
            if i in (3, 7):  # a couple of skipped Fridays
                d -= timedelta(weeks=1)
                continue
            minutes = self.rng.choice([24, 28, 30, 32, 35, 42 if i == 1 else 30])
            km = round(minutes * self.rng.uniform(0.17, 0.2), 1)
            log = WorkoutLog.objects.create(
                athlete=athlete, date=d, focus="اینتروال تردمیل", status="completed", duration_min=minutes,
                avg_hr=self.rng.randint(138, 158) if i % 3 else None, rpe=self.rng.choice([6, 7, 7, 8]),
                max_hr=self.rng.randint(170, 186) if i % 3 else None, cadence_spm=self.rng.randint(162, 176), elevation_m=self.rng.choice([0, 20, 45]),
                # what a Garmin reports after the run (most sessions; a few without the watch)
                aerobic_te=round(self.rng.uniform(2.4, 4.2), 1) if i % 4 != 3 else None,
                anaerobic_te=round(self.rng.uniform(0.4, 2.6), 1) if i % 4 != 3 else None,
                lt_hr=(167 - i // 3) if i % 4 != 3 else None,  # i = 0 is the latest run: threshold improving over time
                lt_pace=round(5.0 + 0.04 * i, 2) if i % 4 != 3 else None,
                started_at=timezone.make_aware(timezone.datetime.combine(d, time(18, 0))),
                finished_at=timezone.make_aware(timezone.datetime.combine(d, time(18, minutes))),
            )  # fmt: skip
            LoggedSet.objects.create(log=log, exercise=treadmill, slot=0, index=0, target_reps=str(minutes), target_value=km, unit="km", done=True)
            d -= timedelta(weeks=1)

    def nutrition(self, athlete, today, days=7):
        plan = NutritionPlan.objects.create(athlete=athlete, kcal=2600, protein=160, carbs=300, fat=75, water_l=2.5)
        meals = []
        for i, (name, t, foods) in enumerate(MEALS):
            served = ["sat", "sun", "mon", "tue", "wed", "thu"] if name == "ناهار" else []  # Friday has its own lunch
            meal = Meal.objects.create(plan=plan, order=i, name=name, time=t, days=served)
            for j, (fname, grams, kcal, p, c, f) in enumerate(foods):
                FoodItem.objects.create(meal=meal, order=j, name=fname, grams=grams, kcal_per_100g=kcal, protein_per_100g=p, carbs_per_100g=c, fat_per_100g=f)
            meals.append(meal)
        # #47: a pre-workout snack only on training days and a lighter Friday lunch.
        pre = Meal.objects.create(plan=plan, order=len(MEALS), name="میان‌وعده قبل از تمرین", time=time(16, 30), days=["sat", "mon", "wed"])
        FoodItem.objects.create(meal=pre, name="موز", grams=120, kcal_per_100g=89, protein_per_100g=1.1, carbs_per_100g=23, fat_per_100g=0.3)
        FoodItem.objects.create(meal=pre, name="کره بادام‌زمینی", grams=20, kcal_per_100g=588, protein_per_100g=25, carbs_per_100g=20, fat_per_100g=50)
        fri = Meal.objects.create(plan=plan, order=len(MEALS) + 1, name="ناهار سبک جمعه", time=time(13, 30), days=["fri"])
        FoodItem.objects.create(meal=fri, name="سالاد مرغ", grams=300, kcal_per_100g=120, protein_per_100g=14, carbs_per_100g=5, fat_per_100g=5)
        for back in range(1, days + 1):
            d = today - timedelta(days=back)
            for meal in meals:
                MealLog.objects.create(athlete=athlete, meal=meal, date=d, status=self.rng.choices(["followed", "partial", "skipped"], [7, 2, 1])[0])
            WaterLog.objects.create(athlete=athlete, date=d, liters=self.rng.choice([1.5, 2, 2.5, 2.5, 3]))
        MealLog.objects.create(athlete=athlete, meal=meals[0], date=today, status="followed")
        MealLog.objects.create(athlete=athlete, meal=meals[1], date=today, status="partial")
        WaterLog.objects.create(athlete=athlete, date=today, liters=1.5)

    def recovery(self, athlete, today, days=14, sore_streak=False):
        """Morning check-ins (a few days skipped); optionally two days of high soreness right before today."""
        for back in range(1, days + 1):
            if back in (4, 11, 19, 33):
                continue
            sore = self.rng.randint(2, 6)
            if sore_streak and back in (1, 2):
                sore = 8
            RecoveryCheckIn.objects.create(
                athlete=athlete, date=today - timedelta(days=back), sleep_hours=self.rng.choice([6, 6.5, 7, 7.5, 8, 8.5]),
                sleep_quality=self.rng.randint(5, 9), energy=self.rng.randint(5, 9), stress=self.rng.randint(2, 6),
                soreness=sore, fatigue=self.rng.randint(2, 6),
                resting_hr=round(62 - 6 * (days - back) / days + self.rng.uniform(-1.5, 1.5)),
                # watch data (optional): HRV drops after the sore days, as it would
                hrv_ms=round(58 + 8 * (days - back) / days + self.rng.uniform(-6, 6) - (12 if sore >= 8 else 0)),
                sleep_score=self.rng.randint(58, 90), body_battery=self.rng.randint(35, 95), steps=self.rng.randint(4000, 14000),
                extra={"c_mood": self.rng.randint(5, 9)},
            )  # fmt: skip

    def measurements(self, athlete, today, scale=1.0):
        """Every two weeks for ~5 months (one missed), trending toward the goal; the athlete records most."""
        start = {
            "weight": 78.9,
            "bodyFat": 16.8,
            "muscleMass": 37.4,
            "chest": 101.5,
            "waist": 83.5,
            "arm": 35.5,
            "thigh": 58,
            "hip": 97.5,
            "calf": 38,
            "neck": 38.5,
        }
        step = {
            "weight": 0.33,
            "bodyFat": -0.19,
            "muscleMass": 0.2,
            "chest": 0.25,
            "waist": -0.15,
            "arm": 0.2,
            "thigh": 0.2,
            "hip": 0.05,
            "calf": 0.05,
            "neck": 0.05,
        }
        n = 11
        for i in range(n):
            if i == 4:
                continue
            back = 14 * (n - 1 - i)
            d = today - timedelta(days=back)
            by = "coach" if i % 3 == 0 else "athlete"
            for metric, v0 in start.items():
                if metric not in ("weight", "bodyFat", "waist") and i % 2:
                    continue  # tape measurements monthly
                v = (v0 + step[metric] * i) * (scale if metric in ("weight", "chest", "waist", "hip") else 1)
                Measurement.objects.create(athlete=athlete, metric=metric, value=round(v + self.rng.uniform(-0.1, 0.1), 1), date=d, recorded_by=by)
        Measurement.objects.create(athlete=athlete, metric="height", value=round(181 * (scale**0.3)), date=today - timedelta(days=140), recorded_by="athlete")

    def tests(self, coach, athletes, today):
        """Field tests in each category, a result every ~4 weeks (C28 endurance & speed, C26 mobility/agility)."""
        defs = [
            # name, category, unit, better, first value, change per test
            ("دوی ۱۰۰ متر", "spd", "s", "lower", 13.6, -0.15),
            ("دوی ۵ کیلومتر", "end", "min", "lower", 26.1, -0.35),
            ("کوپر ۱۲ دقیقه", "end", "m", "higher", 2550, 40),
            ("پرش عمودی", "pow", "cm", "higher", 46, 1.2),
            ("نشستن و رسیدن", "mob", "cm", "higher", 22, 0.8),
            ("تی‌تست چابکی", "agi", "s", "lower", 11.4, -0.12),
        ]
        protocols = {
            "دوی ۱۰۰ متر": "۱۰ دقیقه گرم کردن و ۳ استارت سبک. شروع ایستاده، بهترین زمان از ۲ تکرار با ۵ دقیقه استراحت.",
            "دوی ۵ کیلومتر": "روی پیست یا مسیر صاف، ۱۰ دقیقه گرم کردن. زمان کل به دقیقه ثبت شود.",
            "کوپر ۱۲ دقیقه": "۱۲ دقیقه با بیشترین سرعت ممکن روی پیست ۴۰۰ متری؛ مسافت طی‌شده به متر ثبت شود.",
            "پرش عمودی": "ایستاده کنار دیوار، بدون قدم. بهترین از ۳ پرش؛ اختلاف ارتفاع با دست کشیده.",
            "نشستن و رسیدن": "بدون گرم کردن سنگین، زانوها صاف. بهترین از ۲ تلاش، ۲ ثانیه نگه داشتن.",
            "تی‌تست چابکی": "مخروط‌ها با فاصله ۵ و ۱۰ متر. جلو، چپ، راست، عقب؛ بهترین از ۲ تکرار.",
        }
        tests = [TestDefinition.objects.create(coach=coach, name=n, category=c, unit=u, better=b, protocol=protocols.get(n, "")) for n, c, u, b, *_ in defs]
        for k, athlete in enumerate(athletes):
            for t, (_n, _c, _u, _b, v0, dv) in zip(tests, defs, strict=True):
                count = 6 if k == 0 else 3
                for i in range(count):
                    if k == 0 and t.name == "دوی ۵ کیلومتر" and i == 2:
                        continue  # one month without a 5 km test
                    v = (v0 + dv * i) * (1 + 0.04 * k)
                    TestResult.objects.create(
                        athlete=athlete, test=t, value=round(v, 2 if abs(v) < 100 else 0), date=today - timedelta(days=28 * (count - 1 - i) + 3)
                    )

    def chat(self, athlete, coach, now):
        msgs = [
            (26, "coach", "سلام علی، برنامه هفته ۴ آپدیت شد. پرس سینه ست آخر رو ۶۷٫۵ بزن."),
            (25.9, "athlete", "چشم مربی 💪"),
            (2, "coach", "امروز چک‌این صبح یادت نره. کوفتگی پا رو هم بنویس."),
        ]
        for hours, sender, text in msgs:
            m = Message.objects.create(athlete=athlete, sender=sender, sender_user=coach.user if sender == "coach" else athlete.user, text=text)
            Message.objects.filter(pk=m.pk).update(created_at=now - timedelta(hours=hours), read_at=now if hours > 3 else None)

    def threads(self, athletes, coach, now):
        """A short conversation with each of the other athletes (C33); the latest ones unread."""
        lines = [
            ("athlete", "سلام مربی، امروز زانوم یکم درد داشت. اسکوات رو سبک‌تر بزنم؟"),
            ("coach", "آره، ۲۰٪ سبک‌تر و دامنه کامل. اگه درد موند خبرم کن."),
            ("athlete", "ممنون، انجام دادم. بهتر بود 👍"),
        ]
        for i, a in enumerate(athletes[:4]):
            for j, (sender, text) in enumerate(lines[: 3 - (i % 2)]):
                m = Message.objects.create(athlete=a, sender=sender, sender_user=coach.user if sender == "coach" else a.user, text=text)
                hours = 30 * (i + 1) - j * 3
                Message.objects.filter(pk=m.pk).update(
                    created_at=now - timedelta(hours=hours), read_at=None if (sender == "athlete" and i < 2 and j == 2) else now
                )
