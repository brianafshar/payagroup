from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts import emails
from coaching.models import AccountStatus, Athlete, Coach
from core.models import audit
from training.models import WorkoutLog


class Command(BaseCommand):
    help = (
        "Daily maintenance (run once a day, e.g. from cron at 00:05 Tehran time): deactivate expired coach accounts, "
        "email expiry reminders, close yesterday's unfinished sessions and record missed ones."
    )

    def handle(self, *args, **opts):
        now = timezone.now()
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        # 1. Auto-deactivate coaches past their end date (data is retained; extending reactivates).
        expired = list(Coach.objects.filter(status=AccountStatus.ACTIVE, expires_at__lte=now).select_related("user"))
        for coach in expired:
            coach.status = AccountStatus.INACTIVE
            coach.save(update_fields=["status"])
            coach.user.end_sessions()
            audit(None, "coach.expired", coach)

        # 2. Reminder N days before expiry (once per end date).
        reminded = 0
        for coach in Coach.objects.filter(status=AccountStatus.ACTIVE, expires_at__gt=now).select_related("user"):
            if coach.days_left is not None and coach.days_left <= coach.reminder_days and coach.reminder_sent_for != coach.expires_at:
                try:
                    emails.send_expiry_reminder(coach.user.email, coach.user.name, coach.days_left)
                except emails.EmailNotSent:
                    continue  # logged; retried on the next run
                coach.reminder_sent_for = coach.expires_at
                coach.save(update_fields=["reminder_sent_for"])
                reminded += 1

        # 3. Sessions left open yesterday become partial (or missed when nothing was ticked). One opened on a
        # day that prescribed nothing and left untouched is dropped: that was a rest day, not a miss (#89).
        from training.services import day_parts, session_for, sessions_for, trains

        closed = 0
        for log in WorkoutLog.objects.filter(date__lt=today, status__in=[WorkoutLog.Status.IN_PROGRESS, WorkoutLog.Status.PLANNED]).prefetch_related("sets"):
            done = sum(1 for s in log.sets.all() if s.done)
            if not done and not trains(session_for(log.athlete, log.date, log.program)):
                log.delete()
                continue
            log.status = WorkoutLog.Status.PARTIAL if done else WorkoutLog.Status.MISSED
            log.save(update_fields=["status"])
            closed += 1

        # 4. Prescribed sessions yesterday with no log at all are recorded as missed.
        missed = 0
        for athlete in Athlete.objects.filter(status=AccountStatus.ACTIVE).exclude(program=None).select_related("program"):
            # Each program the athlete follows (#74) has its own session.
            for sess in sessions_for(athlete, yesterday):
                prog = sess["program"]
                if not (prog and trains(sess)):
                    continue
                for part in day_parts(sess["day"]):  # a day with several times: each part on its own
                    if not athlete.workouts.filter(date=yesterday, program=prog, part=part).exists():
                        WorkoutLog.objects.create(athlete=athlete, program=prog, date=yesterday, part=part, status=WorkoutLog.Status.MISSED)
                        missed += 1

        # 5. Audit log retention (A08 › Security).
        from core.models import AuditEvent, PlatformSettings

        keep = PlatformSettings.load().audit_retention_days
        pruned, _ = AuditEvent.objects.filter(at__lt=now - timedelta(days=keep)).delete()

        self.stdout.write(f"expired={len(expired)} reminded={reminded} closed={closed} missed={missed} audit_pruned={pruned}")
