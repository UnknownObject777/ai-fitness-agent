/**
 * Unit tests for nutritionService
 */

import {
  getNutritionAnalysis,
  calculateMacroDistribution,
  calculateNutritionSummary,
  type NutritionAnalysisResult
} from '../../../services/nutritionService';

// Mock database
jest.mock('../../../services/dbService', () => ({
  getDb: jest.fn()
}));

import { getDb } from '../../../services/dbService';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe('nutritionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNutritionAnalysis', () => {
    it('should return complete nutrition analysis', async () => {
      const mockMealLogs = [
        {
          id: 'm1',
          user_id: 'user_123',
          date: '2026-01-15',
          meal_type: 'breakfast',
          food_name: 'Oatmeal with Banana',
          calories: 350,
          protein_g: 12.0,
          carbs_g: 60.0,
          fat_g: 8.0,
          quantity: 1.0,
          unit: 'bowl'
        },
        {
          id: 'm2',
          user_id: 'user_123',
          date: '2026-01-15',
          meal_type: 'lunch',
          food_name: 'Grilled Chicken Salad',
          calories: 450,
          protein_g: 35.0,
          carbs_g: 25.0,
          fat_g: 20.0,
          quantity: 1.0,
          unit: 'serving'
        },
        {
          id: 'm3',
          user_id: 'user_123',
          date: '2026-01-15',
          meal_type: 'dinner',
          food_name: 'Salmon with Vegetables',
          calories: 550,
          protein_g: 40.0,
          carbs_g: 30.0,
          fat_g: 25.0,
          quantity: 1.0,
          unit: 'serving'
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockMealLogs),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getNutritionAnalysis('user_123', '7d');

      expect(result).toBeDefined();
      expect(result.dailyData).toBeDefined();
      expect(result.macroDistribution).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.goalComparison).toBeDefined();
    });

    it('should calculate daily totals correctly', async () => {
      const mockMealLogs = [
        {
          id: 'm1',
          user_id: 'user_123',
          date: '2026-01-15',
          meal_type: 'breakfast',
          food_name: 'Test Food 1',
          calories: 500,
          protein_g: 30.0,
          carbs_g: 50.0,
          fat_g: 20.0,
          quantity: 1.0,
          unit: 'serving'
        },
        {
          id: 'm2',
          user_id: 'user_123',
          date: '2026-01-15',
          meal_type: 'lunch',
          food_name: 'Test Food 2',
          calories: 500,
          protein_g: 30.0,
          carbs_g: 50.0,
          fat_g: 20.0,
          quantity: 1.0,
          unit: 'serving'
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockMealLogs),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getNutritionAnalysis('user_123', '7d');

      // Total: 500 + 500 = 1000 calories
      expect(result.dailyData[0].totalKcal).toBe(1000);
      // Protein: 30 + 30 = 60g
      expect(result.dailyData[0].proteinG).toBe(60);
    });

    it('should calculate macro percentages correctly', async () => {
      const mockMealLogs = [
        {
          id: 'm1',
          user_id: 'user_123',
          date: '2026-01-15',
          meal_type: 'lunch',
          food_name: 'Test Food',
          calories: 400,
          protein_g: 50.0,  // 200 kcal
          carbs_g: 25.0,    // 100 kcal
          fat_g: 11.1,      // ~100 kcal (9 cal/g)
          quantity: 1.0,
          unit: 'serving'
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockMealLogs),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getNutritionAnalysis('user_123', '7d');

      // Protein: 50g * 4 = 200 kcal / 400 total = 50%
      // Carbs: 25g * 4 = 100 kcal / 400 total = 25%
      // Fat: 11.1g * 9 ≈ 100 kcal / 400 total = 25%
      expect(result.macroDistribution.proteinPct).toBeCloseTo(50, 0);
      expect(result.macroDistribution.carbPct).toBeCloseTo(25, 0);
      expect(result.macroDistribution.fatPct).toBeCloseTo(25, 0);
    });

    it('should handle empty meal logs', async () => {
      const mockDb = {
        all: jest.fn().mockResolvedValue([]),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getNutritionAnalysis('user_123', '7d');

      expect(result.dailyData).toEqual([]);
      expect(result.summary.daysLogged).toBe(0);
      expect(result.summary.avgDailyKcal).toBe(0);
    });

    it('should calculate streak correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const mockMealLogs = [
        {
          id: 'm1',
          user_id: 'user_123',
          date: today,
          meal_type: 'breakfast',
          food_name: 'Test',
          calories: 500,
          protein_g: 30,
          carbs_g: 50,
          fat_g: 20,
          quantity: 1,
          unit: 'serving'
        },
        {
          id: 'm2',
          user_id: 'user_123',
          date: yesterday,
          meal_type: 'breakfast',
          food_name: 'Test',
          calories: 500,
          protein_g: 30,
          carbs_g: 50,
          fat_g: 20,
          quantity: 1,
          unit: 'serving'
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockMealLogs),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getNutritionAnalysis('user_123', '7d');

      expect(result.summary.streakDays).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateMacroDistribution', () => {
    it('should calculate macro percentages from daily data', () => {
      const dailyData = [
        {
          date: '2026-01-15',
          totalKcal: 2000,
          proteinG: 150,
          carbG: 200,
          fatG: 67, // approx 603 kcal
          mealCount: 4
        }
      ];

      const result = calculateMacroDistribution(dailyData);

      // Protein: 150g × 4 = 600 kcal / 2000 = 30%
      expect(result.proteinPct).toBeCloseTo(30, 0);
      // Carbs: 200g × 4 = 800 kcal / 2000 = 40%
      expect(result.carbPct).toBeCloseTo(40, 0);
    });

    it('should handle empty daily data', () => {
      const result = calculateMacroDistribution([]);

      expect(result.proteinPct).toBe(0);
      expect(result.carbPct).toBe(0);
      expect(result.fatPct).toBe(0);
      expect(result.avgProteinG).toBe(0);
      expect(result.avgCarbG).toBe(0);
      expect(result.avgFatG).toBe(0);
    });
  });

  describe('calculateNutritionSummary', () => {
    it('should calculate summary statistics', () => {
      const dailyData = [
        { date: '2026-01-15', totalKcal: 2000, proteinG: 140, carbG: 220, fatG: 67, mealCount: 4 },
        { date: '2026-01-16', totalKcal: 2100, proteinG: 145, carbG: 230, fatG: 70, mealCount: 4 }
      ];

      const macroDistribution = {
        proteinPct: 27,
        carbPct: 42,
        fatPct: 31,
        avgProteinG: 142.5,
        avgCarbG: 225,
        avgFatG: 68.5
      };

      const result = calculateNutritionSummary(dailyData, macroDistribution, '7d');

      expect(result.avgDailyKcal).toBe(2050); // (2000 + 2100) / 2
      expect(result.avgProteinG).toBe(142.5);
      expect(result.daysLogged).toBe(2);
      expect(result.proteinGoalPct).toBeGreaterThan(0);
    });

    it('should calculate streak days correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

      const dailyData = [
        { date: today, totalKcal: 2000, proteinG: 140, carbG: 220, fatG: 67, mealCount: 4 },
        { date: yesterday, totalKcal: 2100, proteinG: 145, carbG: 230, fatG: 70, mealCount: 4 },
        { date: twoDaysAgo, totalKcal: 1950, proteinG: 135, carbG: 210, fatG: 65, mealCount: 4 }
      ];

      const macroDistribution = {
        proteinPct: 27,
        carbPct: 42,
        fatPct: 31,
        avgProteinG: 140,
        avgCarbG: 220,
        avgFatG: 67
      };

      const result = calculateNutritionSummary(dailyData, macroDistribution, '7d');

      expect(result.streakDays).toBeGreaterThanOrEqual(3);
    });

    it('should calculate calorie consistency score', () => {
      const dailyData = [
        { date: '2026-01-15', totalKcal: 2000, proteinG: 140, carbG: 220, fatG: 67, mealCount: 4 },
        { date: '2026-01-16', totalKcal: 2005, proteinG: 141, carbG: 221, fatG: 68, mealCount: 4 },
        { date: '2026-01-17', totalKcal: 1995, proteinG: 139, carbG: 219, fatG: 66, mealCount: 4 }
      ];

      const macroDistribution = {
        proteinPct: 27,
        carbPct: 42,
        fatPct: 31,
        avgProteinG: 140,
        avgCarbG: 220,
        avgFatG: 67
      };

      const result = calculateNutritionSummary(dailyData, macroDistribution, '7d');

      // High consistency (low std dev relative to mean) should give high score
      expect(result.calorieConsistencyScore).toBeGreaterThan(80);
      expect(result.calorieConsistencyScore).toBeLessThanOrEqual(100);
    });
  });
});
