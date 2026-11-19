from django.db import migrations


def fill_admin_roles(apps, schema_editor):
    """Admins created in Django admin had no admin role, so the panel gave them no permissions."""
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="admin", admin_role="", is_superuser=True).update(admin_role="super")
    User.objects.filter(role="admin", admin_role="").update(admin_role="support")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_notifications_seen")]

    operations = [migrations.RunPython(fill_admin_roles, migrations.RunPython.noop)]
