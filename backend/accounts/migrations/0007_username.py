from django.db import migrations, models


def fill_usernames(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    seen = set()
    for u in User.objects.order_by("pk"):
        base = (u.email or f"user{u.pk}").strip().lower()
        name, n = base, 1
        while name in seen:
            n += 1
            name = f"{base}-{n}"
        seen.add(name)
        u.username = name
        u.save(update_fields=["username"])


class Migration(migrations.Migration):
    dependencies = [("accounts", "0006_login_sessions")]

    operations = [
        migrations.AddField(model_name="user", name="username", field=models.CharField(max_length=150, null=True, help_text="Sign-in name.")),
        migrations.RunPython(fill_usernames, migrations.RunPython.noop),
        migrations.AlterField(model_name="user", name="username", field=models.CharField(max_length=150, unique=True, help_text="Sign-in name.")),
        migrations.AlterField(
            model_name="user", name="email", field=models.EmailField(blank=True, max_length=254, help_text="Optional contact e-mail (not used to sign in).")
        ),
    ]
