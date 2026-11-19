"""Food bank with household units: search, coach-owned foods, unit → grams in meal plans, supplements."""

import pytest

from tracking.models import Food, FoodItem

from .conftest import Api

pytestmark = pytest.mark.django_db


def as_(user) -> Api:
    return Api().as_user(user)


def test_shared_bank_is_loaded_with_units():
    assert Food.objects.filter(owner=None).count() == 440
    white = Food.objects.get(name="سفیده تخم‌مرغ")
    assert white.default_unit == "عدد"
    assert {u.unit: u.grams for u in white.units.all()} == {"عدد": 33, "گرم": 1}


def test_search_finds_by_name_prefix_first_and_ignores_arabic_letters(coach):
    c = as_(coach.user)
    rows = c.get("/api/foods/?q=سفیده").json()
    assert rows[0]["name"] == "سفیده تخم‌مرغ"
    assert rows[0]["units"][0] == {"unit": "عدد", "grams": 33.0}
    # Arabic ي and a missing zero-width joiner still match
    assert any(r["name"] == "سفیده تخم‌مرغ" for r in c.get("/api/foods/?q=سفيده تخممرغ").json())
    assert c.get("/api/foods/?q=zzz").json() == []


def test_coach_foods_are_private(coach, other_coach, athlete):
    c = as_(coach.user)
    r = c.post(
        "/api/foods/",
        {"name": "پروتئین بار خانگی", "category": "مکمل", "kcalPer100g": 400, "proteinPer100g": 30, "units": [{"unit": "عدد", "grams": 45}]},
        format="json",
    )
    assert r.status_code == 201, r.data
    food = r.json()
    assert food["mine"] is True and food["defaultUnit"] == "عدد"
    assert {u["unit"] for u in food["units"]} == {"عدد", "گرم"}  # grams is always available
    assert any(x["id"] == food["id"] for x in c.get("/api/foods/?q=پروتئین بار خانگی").json())
    o = as_(other_coach.user)
    assert not any(x["id"] == food["id"] for x in o.get("/api/foods/?q=پروتئین بار خانگی").json())
    assert o.delete(f"/api/foods/{food['id']}/").status_code == 404
    # nobody edits the shared bank; athletes don't use this API
    shared = Food.objects.filter(owner=None).first()
    assert c.patch(f"/api/foods/{shared.pk}/", {"name": "x"}, format="json").status_code == 404
    assert as_(athlete.user).get("/api/foods/?q=نان").status_code == 403
    assert c.delete(f"/api/foods/{food['id']}/").status_code == 204


def test_plan_food_by_unit_fills_grams_and_macros(coach, other_coach, athlete):
    white = Food.objects.get(name="سفیده تخم‌مرغ")
    rice = Food.objects.get(name="برنج سفید پخته (کته/آبکش)")
    c = as_(coach.user)
    plan = {
        "targets": {"kcal": 1800, "protein": 160, "carbs": 190, "fat": 50, "waterL": 3},
        "supplements": [{"name": "کراتین", "dose": "۵ گرم", "timing": "بعد از تمرین"}],
        "meals": [
            {
                "name": "صبحانه",
                "foods": [
                    {"food": white.pk, "unit": "عدد", "quantity": 3},
                    {"food": rice.pk, "unit": "کفگیر", "quantity": 1.5},
                    {"name": "قهوه", "grams": 200, "kcalPer100g": 2},
                ],
            }
        ],
    }
    r = c.put(f"/api/nutrition-plans/{athlete.pk}/", plan, format="json")
    assert r.status_code == 200, r.data
    foods = r.json()["meals"][0]["foods"]
    assert foods[0] | {"id": 0, "totals": 0, "units": 0} == {
        "id": 0, "food": white.pk, "unit": "عدد", "quantity": 3.0, "name": "سفیده تخم‌مرغ", "grams": 99.0,
        "kcalPer100g": 52.0, "proteinPer100g": 10.9, "carbsPer100g": 0.7, "fatPer100g": 0.2, "totals": 0, "units": 0,
    }  # fmt: skip
    assert foods[0]["totals"]["kcal"] == 51.5
    assert foods[1]["grams"] == 135.0 and foods[1]["unit"] == "کفگیر"
    assert foods[2]["food"] is None and foods[2]["unit"] == "" and foods[2]["grams"] == 200
    assert r.json()["supplements"] == [{"name": "کراتین", "dose": "۵ گرم", "timing": "بعد از تمرین"}]
    # the athlete reads it the same way
    me = as_(athlete.user).get("/api/nutrition-plans/me/").json()
    assert me["meals"][0]["foods"][0]["quantity"] == 3 and me["supplements"][0]["name"] == "کراتین"

    # a unit the food doesn't have, a missing quantity, and another coach's private food are refused
    bad = {**plan, "meals": [{"name": "x", "foods": [{"food": white.pk, "unit": "کفگیر", "quantity": 1}]}]}
    assert c.put(f"/api/nutrition-plans/{athlete.pk}/", bad, format="json").status_code == 400
    bad["meals"][0]["foods"] = [{"food": white.pk, "unit": "عدد"}]
    assert c.put(f"/api/nutrition-plans/{athlete.pk}/", bad, format="json").status_code == 400
    private = (
        as_(other_coach.user).post("/api/foods/", {"name": "غذای مخفی", "kcalPer100g": 100, "units": [{"unit": "عدد", "grams": 10}]}, format="json").json()
    )
    bad["meals"][0]["foods"] = [{"food": private["id"], "unit": "عدد", "quantity": 1}]
    assert c.put(f"/api/nutrition-plans/{athlete.pk}/", bad, format="json").status_code == 400
    # saving without `supplements` keeps them
    keep = {k: v for k, v in plan.items() if k != "supplements"}
    assert c.put(f"/api/nutrition-plans/{athlete.pk}/", keep, format="json").json()["supplements"][0]["name"] == "کراتین"


def test_deleting_a_food_keeps_planned_items(coach, athlete):
    c = as_(coach.user)
    food = c.post("/api/foods/", {"name": "کیک خانگی", "kcalPer100g": 350, "units": [{"unit": "برش", "grams": 60}]}, format="json").json()
    plan = {
        "targets": {"kcal": 2000, "protein": 100, "carbs": 200, "fat": 60, "waterL": 2},
        "meals": [{"name": "عصرانه", "foods": [{"food": food["id"], "unit": "برش", "quantity": 2}]}],
    }
    c.put(f"/api/nutrition-plans/{athlete.pk}/", plan, format="json")
    c.delete(f"/api/foods/{food['id']}/")
    item = FoodItem.objects.get()
    assert item.food is None and item.name == "کیک خانگی" and item.grams == 120 and item.unit == "برش" and item.quantity == 2
