from django.apps import AppConfig, apps
from django.db.models.signals import pre_save

# Uploaded photos that are downscaled before they're stored (see core.uploads.shrink_image).
SHRINK = [("accounts.User", "photo"), ("training.Exercise", "image"), ("messaging.Message", "attachment")]


class CoreConfig(AppConfig):
    name = "core"
    verbose_name = "Platform"

    def ready(self) -> None:
        from .uploads import shrink_image

        for label, field in SHRINK:

            def handler(sender, instance, field=field, **kwargs):
                shrink_image(instance, field)

            pre_save.connect(handler, sender=apps.get_model(label), weak=False, dispatch_uid=f"shrink:{label}.{field}")
