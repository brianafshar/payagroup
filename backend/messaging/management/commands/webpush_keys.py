from cryptography.hazmat.primitives import serialization
from django.core.management.base import BaseCommand
from py_vapid import Vapid02, b64urlencode


class Command(BaseCommand):
    help = "Generate a VAPID key pair for Web Push; put the two lines in the server's .env."

    def handle(self, *args, **opts):
        v = Vapid02()
        v.generate_keys()
        public = b64urlencode(v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
        private = b64urlencode(v.private_key.private_numbers().private_value.to_bytes(32, "big"))
        self.stdout.write(f"WEBPUSH_PUBLIC_KEY={public}\nWEBPUSH_PRIVATE_KEY={private}\n")
