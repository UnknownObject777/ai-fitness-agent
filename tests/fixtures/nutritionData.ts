/**
 * Test fixtures for nutrition-related data
 */

export const sampleMealLog = {
  id: 'meal_123',
  user_id: 'user_123',
  date: '2026-01-15',
  meal_type: 'lunch',
  food_name: 'Grilled Chicken Salad',
  calories: 450,
  protein_g: 35.0,
  carbs_g: 25.0,
  fat_g: 20.0,
  quantity: 1.0,
  unit: 'serving',
  notes: 'With olive oil dressing',
  created_at: '2026-01-15T12:30:00Z'
};

export const sampleDailyNutrition = {
  date: '2026-01-15',
  totalKcal: 2150,
  proteinG: 140.0,
  carbG: 220.0,
  fatG: 75.0,
  mealCount: 4
};

export const sampleMacroDistribution = {
  proteinPct: 26,
  carbPct: 41,
  fatPct: 33,
  avgProteinG: 140.0,
  avgCarbG: 220.0,
  avgFatG: 75.0
};

export const sampleNutritionAnalysis = {
  dailyData: [sampleDailyNutrition],
  macroDistribution: sampleMacroDistribution,
  summary: {
    avgDailyKcal: 2150,
    avgProteinG: 140.0,
    daysLogged: 1,
    proteinGoalPct: 100,
    calorieConsistencyScore: 95,
    streakDays: 1
  },
  goalComparison: {
    targetKcal: 2000,
    avgKcal: 2150,
    deficitOrSurplus: 150,
    targetProteinG: 126, // 1.8g/kg for 70kg
    avgProteinG: 140.0,
    proteinAdequacy: 'adequate'
  }
};
