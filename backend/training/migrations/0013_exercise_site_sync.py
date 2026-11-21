from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("training", "0012_workout_part")]

    operations = [
        migrations.AddField(model_name="exercise", name="site_synced_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="exercise", name="site_error", field=models.CharField(blank=True, default="", max_length=200), preserve_default=False),
    ]
