import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("coaching", "0001_initial"), ("tracking", "0006_load_food_bank")]

    operations = [
        migrations.CreateModel(
            name="NutritionTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("description", models.CharField(blank=True, max_length=200)),
                ("payload", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("coach", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="nutrition_templates", to="coaching.coach")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
    ]
