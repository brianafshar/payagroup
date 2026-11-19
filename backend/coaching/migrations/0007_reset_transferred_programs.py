from django.db import migrations
from django.db.models import F


def reset(apps, schema_editor):
    """Athletes moved to another coach before transfers reset the program still pointed at the old
    coach's copy, which the new coach can't open («بارگذاری نشد» on the athlete page)."""
    Athlete = apps.get_model("coaching", "Athlete")
    Athlete.objects.exclude(program=None).exclude(program__coach=F("coach")).update(program=None, program_start=None)


class Migration(migrations.Migration):
    dependencies = [("coaching", "0006_athlete_goal_weight_kg_athlete_measure_schedule"), ("training", "0002_exercise_image")]

    operations = [migrations.RunPython(reset, migrations.RunPython.noop)]
