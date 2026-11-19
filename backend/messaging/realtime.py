"""Pushes events to connected WebSocket clients. Each signed-in user listens on `user_<id>`; events are
sent after the database transaction commits, and a missing/unreachable channel layer never breaks a request."""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

log = logging.getLogger(__name__)


def group(user_id: int) -> str:
    return f"user_{user_id}"


def send_to_users(user_ids, event: dict) -> None:
    ids = [u for u in set(user_ids) if u]

    def _send():
        layer = get_channel_layer()
        if layer is None:
            return
        for uid in ids:
            try:
                async_to_sync(layer.group_send)(group(uid), event)
            except Exception:  # noqa: BLE001 — realtime is best effort
                log.exception("realtime send failed")

    transaction.on_commit(_send)


def send_to_group(name: str, event: dict) -> None:
    """One named group, e.g. the sockets of a single sign-in session (`accounts.sessions.group`)."""

    def _send():
        layer = get_channel_layer()
        if layer is None:
            return
        try:
            async_to_sync(layer.group_send)(name, event)
        except Exception:  # noqa: BLE001 — realtime is best effort
            log.exception("realtime send failed")

    transaction.on_commit(_send)


def thread_users(athlete) -> list[int]:
    """Everyone who sees an athlete's chat thread: the athlete and their coach."""
    return [athlete.user_id, athlete.coach.user_id]
