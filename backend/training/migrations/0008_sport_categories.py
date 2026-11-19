"""#75: swimming and cycling sessions get their own categories (they were filed under «آمادگی هوازی»)."""

from django.db import migrations

MOVES = {"swimming": "swim", "cycling": "ride"}


def forward(apps, schema_editor):
    Exercise = apps.get_model("training", "Exercise")
    for sport, cat in MOVES.items():
        Exercise.objects.filter(sport=sport, category="conditioning").update(category=cat)


def backward(apps, schema_editor):
    Exercise = apps.get_model("training", "Exercise")
    for sport, cat in MOVES.items():
        Exercise.objects.filter(sport=sport, category=cat).update(category="conditioning")


class Migration(migrations.Migration):
    dependencies = [("training", "0007_watch_training_effect")]
    operations = [migrations.RunPython(forward, backward)]
