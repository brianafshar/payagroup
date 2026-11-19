import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django_asgi = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from django.urls import path  # noqa: E402

from messaging.consumers import RealtimeConsumer  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi,
        # Authentication happens inside the socket (first message carries the JWT), so no cookies are involved.
        "websocket": URLRouter([path("ws/", RealtimeConsumer.as_asgi())]),
    }
)
