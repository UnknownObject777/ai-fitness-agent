from typing import TypedDict


class FoodNutrition(TypedDict):
    id: str
    name: str
    defaultUnit: str
    caloriesPer100g: float
    proteinPer100g: float
    carbsPer100g: float
    fatPer100g: float


MOCK_FOOD_DB: list[FoodNutrition] = [
    {"id": "f_rice", "name": "白米饭", "defaultUnit": "g", "caloriesPer100g": 130, "proteinPer100g": 2.6, "carbsPer100g": 28.0, "fatPer100g": 0.3},
    {"id": "f_chicken", "name": "鸡胸肉", "defaultUnit": "g", "caloriesPer100g": 120, "proteinPer100g": 22.5, "carbsPer100g": 0, "fatPer100g": 2.6},
    {"id": "f_egg", "name": "鸡蛋", "defaultUnit": "g", "caloriesPer100g": 144, "proteinPer100g": 12.5, "carbsPer100g": 0.7, "fatPer100g": 10.0},
    {"id": "f_beef", "name": "瘦牛肉", "defaultUnit": "g", "caloriesPer100g": 250, "proteinPer100g": 26.0, "carbsPer100g": 0, "fatPer100g": 15.0},
    {"id": "f_broccoli", "name": "西兰花", "defaultUnit": "g", "caloriesPer100g": 34, "proteinPer100g": 2.8, "carbsPer100g": 6.6, "fatPer100g": 0.4},
    {"id": "f_milk", "name": "全脂牛奶", "defaultUnit": "ml", "caloriesPer100g": 61, "proteinPer100g": 3.2, "carbsPer100g": 4.8, "fatPer100g": 3.3},
    {"id": "f_oats", "name": "燕麦片", "defaultUnit": "g", "caloriesPer100g": 389, "proteinPer100g": 16.9, "carbsPer100g": 66.3, "fatPer100g": 6.9},
]


async def search_food_logics(query: str) -> list[FoodNutrition]:
    needle = query.lower().strip()
    if not needle:
        return []
    return [food for food in MOCK_FOOD_DB if needle in food["name"].lower() or needle in food["id"].lower()]

