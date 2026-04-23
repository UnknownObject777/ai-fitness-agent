/**
 * Unit tests for insightEngine service
 */

import {
  generateWorkoutInsights,
  generateNutritionInsights,
  generateCombinedInsights,
  type Insight,
  type WorkoutTrendsResult,
  type NutritionAnalysisResult
} from '../../../services/insightEngine';

describe('insightEngine', () => {
  describe('generateWorkoutInsights', () => {
    const mockWorkoutData: WorkoutTrendsResult = {
      trendPoints: [
        {
          date: '2026-01-15',
          totalVolume: 5000,
          workoutCount: 1,
          durationMin: 60,
          avgRpe: 8,
          muscleGroups: ['chest', 'triceps']
        },
        {
          date: '2026-01-16',
          totalVolume: 5200,
          workoutCount: 1,
          durationMin: 65,
          avgRpe: 8.5,
          muscleGroups: ['back', 'biceps']
        }
      ],
      muscleDistribution: [
        { group: 'chest', volume: 5000, sessions: 1 },
        { group: 'back', volume: 5200, sessions: 1 },
        { group: 'legs', volume: 0, sessions: 0 }
      ],
      strengthProgress: [
        {
          date: '2026-01-15',
          exercise: 'Bench Press',
          estimated1RM: 100,
          bestSet: { weight: 80, reps: 10 }
        }
      ],
      summary: {
        totalWorkouts: 2,
        totalVolume: 10200,
        avgWorkoutsPerWeek: 2,
        mostTrainedGroup: 'back',
        totalDurationMin: 125
      }
    };

    it('should generate insights for good training frequency', () => {
      const insights = generateWorkoutInsights(mockWorkoutData);

      const frequencyInsight = insights.find(i => i.category === 'workout' && i.title.includes('训练频率'));
      expect(frequencyInsight).toBeDefined();
      expect(frequencyInsight?.type).toBe('success');
    });

    it('should generate muscle imbalance warning', () => {
      const insights = generateWorkoutInsights(mockWorkoutData);

      const imbalanceInsight = insights.find(i => i.category === 'workout' && i.title.includes('肌群平衡'));
      // Should warn about legs being undertrained
      expect(imbalanceInsight).toBeDefined();
    });

    it('should generate volume trend insight', () => {
      const insights = generateWorkoutInsights(mockWorkoutData);

      const volumeInsight = insights.find(i => i.category === 'workout' && i.title.includes('训练量'));
      expect(volumeInsight).toBeDefined();
    });

    it('should return insights sorted by priority', () => {
      const insights = generateWorkoutInsights(mockWorkoutData);

      for (let i = 1; i < insights.length; i++) {
        expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority);
      }
    });

    it('should handle empty workout data', () => {
      const emptyData: WorkoutTrendsResult = {
        trendPoints: [],
        muscleDistribution: [],
        strengthProgress: [],
        summary: {
          totalWorkouts: 0,
          totalVolume: 0,
          avgWorkoutsPerWeek: 0,
          mostTrainedGroup: '',
          totalDurationMin: 0
        }
      };

      const insights = generateWorkoutInsights(emptyData);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some(i => i.type === 'warning')).toBe(true);
    });
  });

  describe('generateNutritionInsights', () => {
    const mockNutritionData: NutritionAnalysisResult = {
      dailyData: [
        {
          date: '2026-01-15',
          totalKcal: 2100,
          proteinG: 140,
          carbG: 220,
          fatG: 70,
          mealCount: 4
        }
      ],
      macroDistribution: {
        proteinPct: 27,
        carbPct: 42,
        fatPct: 31,
        avgProteinG: 140,
        avgCarbG: 220,
        avgFatG: 70
      },
      summary: {
        avgDailyKcal: 2100,
        avgProteinG: 140,
        daysLogged: 7,
        proteinGoalPct: 100,
        calorieConsistencyScore: 90,
        streakDays: 7
      },
      goalComparison: {
        targetKcal: 2000,
        avgKcal: 2100,
        deficitOrSurplus: 100,
        targetProteinG: 126,
        avgProteinG: 140,
        proteinAdequacy: 'adequate'
      }
    };

    it('should generate calorie adequacy insight', () => {
      const insights = generateNutritionInsights(mockNutritionData);

      const calorieInsight = insights.find(i => i.category === 'nutrition' && i.title.includes('热量'));
      expect(calorieInsight).toBeDefined();
    });

    it('should generate protein intake insight', () => {
      const insights = generateNutritionInsights(mockNutritionData);

      const proteinInsight = insights.find(i => i.category === 'nutrition' && i.title.includes('蛋白质'));
      expect(proteinInsight).toBeDefined();
      expect(proteinInsight?.type).toBe('success'); // Adequate protein
    });

    it('should generate macro balance insight', () => {
      const insights = generateNutritionInsights(mockNutritionData);

      const macroInsight = insights.find(i => i.category === 'nutrition' && i.title.includes('营养'));
      expect(macroInsight).toBeDefined();
    });

    it('should warn when protein is low', () => {
      const lowProteinData = {
        ...mockNutritionData,
        summary: {
          ...mockNutritionData.summary,
          avgProteinG: 80 // Low protein
        },
        goalComparison: {
          ...mockNutritionData.goalComparison,
          avgProteinG: 80,
          proteinAdequacy: 'low' as const
        }
      };

      const insights = generateNutritionInsights(lowProteinData);

      const proteinInsight = insights.find(i => i.category === 'nutrition' && i.title.includes('蛋白质'));
      expect(proteinInsight?.type).toBe('warning');
    });

    it('should return insights sorted by priority', () => {
      const insights = generateNutritionInsights(mockNutritionData);

      for (let i = 1; i < insights.length; i++) {
        expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority);
      }
    });
  });

  describe('generateCombinedInsights', () => {
    it('should combine workout and nutrition insights', () => {
      const workoutData: WorkoutTrendsResult = {
        trendPoints: [{
          date: '2026-01-15',
          totalVolume: 5000,
          workoutCount: 1,
          durationMin: 60,
          avgRpe: 8,
          muscleGroups: ['chest']
        }],
        muscleDistribution: [{ group: 'chest', volume: 5000, sessions: 1 }],
        strengthProgress: [],
        summary: {
          totalWorkouts: 1,
          totalVolume: 5000,
          avgWorkoutsPerWeek: 1,
          mostTrainedGroup: 'chest',
          totalDurationMin: 60
        }
      };

      const nutritionData: NutritionAnalysisResult = {
        dailyData: [{
          date: '2026-01-15',
          totalKcal: 2000,
          proteinG: 140,
          carbG: 220,
          fatG: 70,
          mealCount: 4
        }],
        macroDistribution: {
          proteinPct: 28,
          carbPct: 44,
          fatPct: 31,
          avgProteinG: 140,
          avgCarbG: 220,
          avgFatG: 70
        },
        summary: {
          avgDailyKcal: 2000,
          avgProteinG: 140,
          daysLogged: 1,
          proteinGoalPct: 100,
          calorieConsistencyScore: 95,
          streakDays: 1
        },
        goalComparison: {
          targetKcal: 2000,
          avgKcal: 2000,
          deficitOrSurplus: 0,
          targetProteinG: 126,
          avgProteinG: 140,
          proteinAdequacy: 'adequate'
        }
      };

      const insights = generateCombinedInsights(workoutData, nutritionData);

      // Should have insights from both workout and nutrition
      expect(insights.length).toBeGreaterThan(0);

      // Check for workout-related insights
      expect(insights.some(i => i.category === 'workout')).toBe(true);

      // Check for nutrition-related insights
      expect(insights.some(i => i.category === 'nutrition')).toBe(true);
    });

    it('should return empty array when no data provided', () => {
      const insights = generateCombinedInsights(
        null as any,
        null as any
      );

      expect(insights).toEqual([]);
    });
  });
});
