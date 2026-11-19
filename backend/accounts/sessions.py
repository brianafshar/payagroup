"""Sign-in sessions per device (see `LoginSession`): started when tokens are issued, checked on every
request (cached briefly), and ended one by one by the user or an admin."""

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from .models import LoginSession

TOUCH_EVERY = timedelta(minutes=1)
CACHE_SECONDS = 30


def _key(sid) -> str:
    return f"login-session:{sid}"


def client_of(request) -> str:
    """Our apps say who they are in `X-Client` (panel / app-android / app-ios / app-web)."""
    c = (request.headers.get("X-Client") or "").strip().lower()
    return c if c in LoginSession.Client.values else LoginSession.Client.OTHER


def ip_of(request) -> str | None:
    fwd = request.headers.get("X-Forwarded-For", "")
    ip = fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")
    return ip or None


def start(user, request) -> LoginSession:
    return LoginSession.objects.create(user=user, client=client_of(request), user_agent=(request.headers.get("User-Agent") or "")[:300], ip=ip_of(request))


def is_live(sid) -> bool:
    """False once the session was ended. Tokens from before sessions existed (no `sid`) stay valid."""
    if not sid:
        return True
    hit = cache.get(_key(sid))
    if hit is not None:
        return hit
    s = LoginSession.objects.filter(pk=sid).only("ended_at").first()
    live = s is not None and s.ended_at is None
    cache.set(_key(sid), live, CACHE_SECONDS)
    return live


def touch(sid) -> None:
    """Record activity (at most once a minute per session)."""
    if not sid or cache.get(_key(sid) + ":t"):
        return
    cache.set(_key(sid) + ":t", 1, int(TOUCH_EVERY.total_seconds()))
    LoginSession.objects.filter(pk=sid, ended_at__isnull=True).update(last_seen_at=timezone.now())


def end(session: LoginSession, by: str) -> None:
    """End one device's session: tokens refused, socket closed, push registration removed."""
    from messaging.models import Device
    from messaging.realtime import send_to_group

    if session.ended_at is None:
        session.ended_at, session.ended_by = timezone.now(), by
        session.save(update_fields=["ended_at", "ended_by"])
    Device.objects.filter(session=session).delete()
    cache.set(_key(session.pk), False, CACHE_SECONDS)
    send_to_group(group(session.pk), {"type": "session.end"})


def group(sid) -> str:
    return f"sess_{str(sid).replace('-', '')}"
