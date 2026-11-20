from django.db import migrations, models

import core.models as m


class Migration(migrations.Migration):
    dependencies = [("core", "0003_section_usage")]

    operations = [
        migrations.CreateModel(
            name="SmsSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("api_key", models.CharField(blank=True, max_length=200)),
                ("sender", models.CharField(blank=True, max_length=32)),
                ("account_text", models.TextField(default=m.DEFAULT_ACCOUNT_SMS)),
                ("program_text", models.TextField(default=m.DEFAULT_PROGRAM_SMS)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"verbose_name": "SMS settings", "verbose_name_plural": "SMS settings"},
        ),
    ]
