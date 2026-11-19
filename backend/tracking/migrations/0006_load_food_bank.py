"""Loads the shared food bank (data/foods_fa.json: Persian foods with per-100 g macros and household units)."""

import json
from pathlib import Path

from django.db import migrations

DATA = Path(__file__).resolve().parent.parent / "data" / "foods_fa.json"


def load(apps, schema_editor):
    Food = apps.get_model("tracking", "Food")
    FoodUnit = apps.get_model("tracking", "FoodUnit")
    for row in json.loads(DATA.read_text(encoding="utf-8")):
        food = Food.objects.create(
            owner=None,
            name=row["name"],
            category=row.get("category", ""),
            kcal_per_100g=row["kcalPer100g"],
            protein_per_100g=row.get("proteinPer100g", 0),
            carbs_per_100g=row.get("carbsPer100g", 0),
            fat_per_100g=row.get("fatPer100g", 0),
            default_unit=row.get("defaultUnit") or "گرم",
        )
        units = list(row.get("units") or [])
        if not any(u["unit"] == "گرم" for u in units):
            units.append({"unit": "گرم", "grams": 1})
        FoodUnit.objects.bulk_create([FoodUnit(food=food, unit=u["unit"], grams=u["grams"], order=i) for i, u in enumerate(units)])


def unload(apps, schema_editor):
    apps.get_model("tracking", "Food").objects.filter(owner=None).delete()


class Migration(migrations.Migration):
    dependencies = [("tracking", "0005_food_bank")]
    operations = [migrations.RunPython(load, unload)]
