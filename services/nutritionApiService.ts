/**
 * Nutrition API Service (Mocking NutriData or similar)
 * In the future, this can be swapped with real HTTP calls to external API.
 */

export interface FoodNutrition {
  id: string;
  name: string;
  defaultUnit: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

const MOCK_FOOD_DB: FoodNutrition[] = [
  { id: "f_rice", name: "白米饭", defaultUnit: "g", caloriesPer100g: 130, proteinPer100g: 2.6, carbsPer100g: 28.0, fatPer100g: 0.3 },
  { id: "f_chicken", name: "鸡胸肉 (生)", defaultUnit: "g", caloriesPer100g: 120, proteinPer100g: 22.5, carbsPer100g: 0, fatPer100g: 2.6 },
  { id: "f_egg", name: "鸡蛋 (全蛋)", defaultUnit: "g", caloriesPer100g: 144, proteinPer100g: 12.5, carbsPer100g: 0.7, fatPer100g: 10.0 },
  { id: "f_beef", name: "瘦牛肉", defaultUnit: "g", caloriesPer100g: 250, proteinPer100g: 26.0, carbsPer100g: 0, fatPer100g: 15.0 },
  { id: "f_broccoli", name: "西兰花", defaultUnit: "g", caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 6.6, fatPer100g: 0.4 },
  { id: "f_milk", name: "全脂牛奶", defaultUnit: "ml", caloriesPer100g: 61, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3 },
  { id: "f_oats", name: "燕麦片 (干)", defaultUnit: "g", caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9 }
];

export async function searchFoodLogics(query: string): Promise<FoodNutrition[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const lowerQ = query.toLowerCase();
  if (!lowerQ.trim()) return [];

  return MOCK_FOOD_DB.filter(f => f.name.toLowerCase().includes(lowerQ));
}
