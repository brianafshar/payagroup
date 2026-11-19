"""Invite / reset / password flows shared by the auth, admin and coach endpoints."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import audit

from . import emails
from .models import Invite, ResetToken, User, random_password


def _link(obj, raw: str, sent: bool) -> dict:
    return {"url": None if sent else obj.url_for(raw), "expires_at": obj.expires_at, "sent": sent}


@transaction.atomic
def issue_invite(*, kind: str, email: str, name: str, by, send: bool, user=None, athlete=None, coach=None, to: str | None = None) -> dict:
    """New single-use invite (older unused ones for the same person are revoked).
    `send` emails it; otherwise the URL is returned for copying, which is audit-logged."""
    if not email:
        raise ValidationError({"email": "An email is required to invite."})
    scope = {"user": user} if user is not None else {"athlete": athlete}
    Invite.objects.usable().filter(**scope).update(expires_at=timezone.now())
    invite, raw = Invite.issue(created_by=by, kind=kind, email=email, **scope)
    target = user or athlete
    if send:
        emails.send_invite(to or email, name, invite.url_for(raw), kind, inviter=getattr(by, "name", ""), app_name=coach.app_name if coach else "indow")
        audit(by, "invite.send", target, kind=kind)
    else:
        audit(by, "invite.copy", target, kind=kind)
    return _link(invite, raw, send)


@transaction.atomic
def issue_reset(user: User, *, by, send: bool, to: str | None = None) -> dict:
    ResetToken.objects.usable().filter(user=user).update(expires_at=timezone.now())
    token, raw = ResetToken.issue(created_by=by, user=user)
    if send:
        emails.send_reset(to or user.email, user.name, token.url_for(raw))
        audit(by, "password.reset-email", user)
    else:
        audit(by, "password.reset-link", user)
    return _link(token, raw, send)


def set_password(user: User, password: str, *, by, force_change: bool = False, email_user: bool = False) -> None:
    """Admin-initiated password change: ends all of the user's sessions and is audit-logged."""
    user.set_password(password)
    user.force_password_change = force_change
    user.session_epoch += 1
    user.save(update_fields=["password", "force_password_change", "session_epoch"])
    user.notify_sessions_ended()
    if email_user:
        emails.send_new_password(user.email, user.name, password, force_change)
    audit(by, "password.change", user, force_change=force_change, emailed=email_user)


def email_temporary_password(user: User) -> None:
    """Self-service "forgot password": a new random password (letters + digits) is emailed to the user, who
    must choose their own after signing in (web panels and the athlete app both enforce it). Old sessions
    end. If the email can't be sent, nothing changes."""
    password = random_password()
    with transaction.atomic():
        user.set_password(password)
        user.force_password_change = True
        user.session_epoch += 1
        user.save(update_fields=["password", "force_password_change", "session_epoch"])
        emails.send_temporary_password(user.email, user.name, password)
        audit(user, "password.forgot", user)
    user.notify_sessions_ended()


def apply_new_password(user: User, password: str) -> None:
    """Self-service reset: new password, and every existing session ends."""
    user.set_password(password)
    user.force_password_change = False
    user.session_epoch += 1
    user.save(update_fields=["password", "force_password_change", "session_epoch"])
    user.notify_sessions_ended()


@transaction.atomic
def accept_invite(raw: str, password: str) -> User:
    invite = Invite.objects.select_for_update().by_token(raw).first()
    if invite is None or not invite.usable:
        raise ValidationError({"token": "This invite link has expired or was already used."}, code="invite_expired")
    if invite.kind == Invite.Kind.ATHLETE:
        athlete = invite.athlete
        user = athlete.user
        if user is None:
            if User.objects.filter(email=invite.email.lower()).exists():
                raise ValidationError({"email": "An account with this email already exists."}, code="conflict")
            user = User.objects.create_user(invite.email, name=athlete.name, role=User.Role.ATHLETE, phone=athlete.phone)
            athlete.user = user
        athlete.status = "active"
        athlete.save(update_fields=["user", "status"])
    else:
        user = invite.user
        if invite.kind == Invite.Kind.COACH:
            coach = user.coach
            coach.activate()
            coach.save()
    user.set_password(password)
    user.is_active = True
    user.force_password_change = False
    user.save(update_fields=["password", "is_active", "force_password_change"])
    invite.consume()
    audit(user, "invite.accept", user, kind=invite.kind)
    return user


@transaction.atomic
def reset_password(raw: str, password: str) -> User:
    token = ResetToken.objects.select_for_update().by_token(raw).select_related("user").first()
    if token is None or not token.usable:
        raise ValidationError({"token": "This reset link has expired or was already used."}, code="reset_expired")
    user = token.user
    apply_new_password(user, password)
    token.consume()
    audit(user, "password.reset", user)
    return user
