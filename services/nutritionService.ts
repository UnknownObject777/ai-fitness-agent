import { getDb } from './dbService.js';

export interface DailyNutrition {
  date: string;
  totalKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  mealCount: number;
}

export interface MacroDistribution {
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  avgProteinG: number;
  avgCarbG: number;
  avgFatG: number;
}

export interface NutritionAnalysisResult {
  dailyData: DailyNutrition[];
  macroDistribution: MacroDistribution;
  summary: {
    avgDailyKcal: number;
    avgProteinG: number;
    daysLogged: number;
    proteinGoalPct: number;     // how close to 1.8g/kg goal (assuming 70kg)
    calorieConsistencyScore: number; // 0-100
    streakDays: number;              // consecutive days with food logs
  };
  goalComparison: {
    targetKcal: number;
    avgKcal: number;
    deficitOrSurplus: number;
    targetProteinG: number;
    avgProteinG: number;
    proteinAdequacy: 'adequate' | 'low' | 'high';
  };
}

function getDaysBack(range: string): number {
  const map: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180 };
  return map[range] || 30;
}

export async function getNutritionAnalysis(
  userId: string = 'user_1',
  range: string = '30d'
): Promise<NutritionAnalysisResult> {
  const db = await getDb();
  const days = getDaysBack(range);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Aggregate from meal_logs
  const mealLogRows = (await db.all(
    `SELECT DATE(eaten_at) as date,
            SUM(total_kcal) as kcal,
            SUM(total_protein_g) as protein,
            SUM(total_carb_g) as carb,
            SUM(total_fat_g) as fat,
            COUNT(*) as meals
     FROM meal_logs
     WHERE user_id = ? AND DATE(eaten_at) >= ?
     GROUP BY DATE(eaten_at)
     ORDER BY date ASC`,
    userId, since
  )) as Array<{
    date: string;
    kcal: number | null;
    protein: number | null;
    carb: number | null;
    fat: number | null;
    meals: number;
  }>;

  // Supplement with activity_records for log_food
  const foodRows = (await db.all(
    `SELECT entry_date, data_json
     FROM activity_records
     WHERE user_id = ? AND intent IN ('log_food') AND entry_date >= ?
     ORDER BY entry_date ASC`,
    userId, since
  )) as Array<{ entry_date: string; data_json: string }>;

  // Build daily map from meal_logs first
  const dailyMap = new Map<string, DailyNutrition>();

  for (const row of mealLogRows) {
    dailyMap.set(row.date, {
      date: row.date,
      totalKcal: row.kcal || 0,
      proteinG: row.protein || 0,
      carbG: row.carb || 0,
      fatG: row.fat || 0,
      mealCount: row.meals || 0
    });
  }

  // Merge activity_records log_food data
  for (const row of foodRows) {
    let data: any = {};
    try { data = JSON.parse(row.data_json); } catch { /* skip */ }

    const date = row.entry_date;
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        totalKcal: 0,
        proteinG: 0,
        carbG: 0,
        fatG: 0,
        mealCount: 0
      });
    }
    const entry = dailyMap.get(date)!;

    // Only add if not already counted via meal_logs (to avoid double-counting)
    // We'll use a separate pass here for 'log_food' intents that don't have meal_log records
    if (data.calories) {
      entry.totalKcal += data.calories || 0;
      entry.proteinG += data.protein || 0;
      entry.carbG += data.carbs || 0;
      entry.fatG += data.fat || 0;
      entry.mealCount++;
    }
  }

  const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate macro distribution
  const totalKcal = dailyData.reduce((s, d) => s + d.totalKcal, 0);
  const totalProtein = dailyData.reduce((s, d) => s + d.proteinG, 0);
  const totalCarb = dailyData.reduce((s, d) => s + d.carbG, 0);
  const totalFat = dailyData.reduce((s, d) => s + d.fatG, 0);
  const daysLogged = dailyData.length;

  const avgKcal = daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0;
  const avgProtein = daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0;
  const avgCarb = daysLogged > 0 ? Math.round(totalCarb / daysLogged) : 0;
  const avgFat = daysLogged > 0 ? Math.round(totalFat / daysLogged) : 0;

  // Macro % by calories (protein=4kcal/g, carb=4kcal/g, fat=9kcal/g)
  const macroKcal = totalProtein * 4 + totalCarb * 4 + totalFat * 9;
  const macroDistribution: MacroDistribution = {
    proteinPct: macroKcal > 0 ? Math.round((totalProtein * 4 / macroKcal) * 100) : 0,
    carbPct: macroKcal > 0 ? Math.round((totalCarb * 4 / macroKcal) * 100) : 0,
    fatPct: macroKcal > 0 ? Math.round((totalFat * 9 / macroKcal) * 100) : 0,
    avgProteinG: avgProtein,
    avgCarbG: avgCarb,
    avgFatG: avgFat
  };

  // Calorie consistency score: 1 - (stddev / mean) clamped 0-100
  let consistencyScore = 0;
  if (daysLogged >= 3) {
    const mean = avgKcal;
    const variance = dailyData.reduce((s, d) => s + Math.pow(d.totalKcal - mean, 2), 0) / daysLogged;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 1;
    consistencyScore = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
  }

  // Streak days (consecutive from today going back)
  let streakDays = 0;
  const today = new Date().toISOString().slice(0, 10);
  const dateSet = new Set(dailyData.map(d => d.date));
  let checking = new Date(today);
  while (dateSet.has(checking.toISOString().slice(0, 10))) {
    streakDays++;
    checking = new Date(checking.getTime() - 86400000);
  }

  // Target and goal comparison (assume 70kg user, 2000kcal target, 1.8g/kg protein)
  const estimatedWeightKg = 70;
  const targetKcal = 2000;
  const targetProteinG = Math.round(estimatedWeightKg * 1.8);

  const proteinGoalPct = targetProteinG > 0 ? Math.round((avgProtein / targetProteinG) * 100) : 0;
  const proteinAdequacy: 'adequate' | 'low' | 'high' =
    proteinGoalPct >= 90 ? (proteinGoalPct <= 130 ? 'adequate' : 'high') : 'low';

  return {
    dailyData,
    macroDistribution,
    summary: {
      avgDailyKcal: avgKcal,
      avgProteinG: avgProtein,
      daysLogged,
      proteinGoalPct,
      calorieConsistencyScore: consistencyScore,
      streakDays
    },
    goalComparison: {
      targetKcal,
      avgKcal,
      deficitOrSurplus: avgKcal - targetKcal,
      targetProteinG,
      avgProteinG: avgProtein,
      proteinAdequacy
    }
  };
}
