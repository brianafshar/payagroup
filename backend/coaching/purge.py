"""Delete an athlete or a whole coach workspace for good (#77, #102): every row goes with the database
cascades, and the uploaded files those rows point to (chat attachments, photos, exercise videos, logos,
documents) are removed from storage too. The app accounts are signed out first."""

from django.db import transaction

from .models import Athlete, Coach


def _drop_files(*fields) -> None:
    """Delete stored files once the rows are gone (after commit, so a rollback keeps them)."""
    names = [(f.storage, f.name) for f in fields if f]

    def run():
        for storage, name in names:
            try:
                storage.delete(name)
            except Exception:  # a missing file is fine: the record is what mattered
                pass

    transaction.on_commit(run)


def _athlete_files(athlete: Athlete) -> list:
    files = [m.attachment for m in athlete.messages.exclude(attachment="")]
    if athlete.user_id and athlete.user.photo:
        files.append(athlete.user.photo)
    return files


def delete_athlete(athlete: Athlete) -> None:
    files = _athlete_files(athlete)
    user = athlete.user
    with transaction.atomic():
        athlete.delete()
        if user is not None and user.role == "athlete":
            user.notify_sessions_ended()
            user.delete()
        _drop_files(*files)


def delete_coach(coach: Coach) -> int:
    """The coach, their athletes (and everything of theirs), programs, library, foods, groups and account.
    Returns how many athletes went with it."""
    files = [coach.logo] if coach.logo else []
    for ex in coach.exercises.all():
        files += [ex.video, ex.image]
    files += [d.file for d in coach.documents.all()]
    for g in coach.chat_groups.all():
        files += [m.attachment for m in g.messages.exclude(attachment="")]
    user = coach.user
    if user.photo:
        files.append(user.photo)
    athletes = list(coach.athletes.select_related("user"))
    with transaction.atomic():
        for a in athletes:
            delete_athlete(a)
        coach.delete()
        user.notify_sessions_ended()
        user.delete()
        _drop_files(*files)
    return len(athletes)
