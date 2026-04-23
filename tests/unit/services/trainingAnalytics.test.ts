/**
 * Unit tests for trainingAnalytics service
 */

import {
  getWorkoutTrends,
  getBodyMetricsTrend,
  WorkoutTrendsResult,
  BodyMetricPoint
} from '../../../services/trainingAnalytics';

// Mock database
jest.mock('../../../services/dbService', () => ({
  getDb: jest.fn()
}));

import { getDb } from '../../../services/dbService';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe('trainingAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkoutTrends', () => {
    it('should return workout trends for 7d range', async () => {
      const mockWorkoutLogs = [
        {
          id: 'w1',
          user_id: 'user_123',
          date: '2026-01-15',
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 4,
          reps: 10,
          weight_kg: 80.0,
          rpe: 8,
          duration_min: 60
        },
        {
          id: 'w2',
          user_id: 'user_123',
          date: '2026-01-15',
          exercise_name: 'Squat',
          muscle_group: 'legs',
          sets: 3,
          reps: 8,
          weight_kg: 100.0,
          rpe: 9,
          duration_min: 60
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockWorkoutLogs),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getWorkoutTrends('user_123', '7d');

      expect(result).toBeDefined();
      expect(result.trendPoints).toBeDefined();
      expect(result.muscleDistribution).toBeDefined();
      expect(result.strengthProgress).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalWorkouts).toBeGreaterThan(0);
    });

    it('should calculate volume correctly', async () => {
      const mockWorkoutLogs = [
        {
          id: 'w1',
          user_id: 'user_123',
          date: '2026-01-15',
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 4,
          reps: 10,
          weight_kg: 80.0,
          rpe: 8,
          duration_min: 60
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockWorkoutLogs),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getWorkoutTrends('user_123', '7d');

      // Volume = sets × reps × weight = 4 × 10 × 80 = 3200
      expect(result.summary.totalVolume).toBe(3200);
    });

    it('should return empty results when no workout data', async () => {
      const mockDb = {
        all: jest.fn().mockResolvedValue([]),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getWorkoutTrends('user_123', '7d');

      expect(result.trendPoints).toEqual([]);
      expect(result.muscleDistribution).toEqual([]);
      expect(result.strengthProgress).toEqual([]);
      expect(result.summary.totalWorkouts).toBe(0);
      expect(result.summary.totalVolume).toBe(0);
    });
  });

  describe('getBodyMetricsTrend', () => {
    it('should return body metrics trend', async () => {
      const mockMetrics = [
        {
          id: 'm1',
          user_id: 'user_123',
          date: '2026-01-01',
          weight_kg: 72.0,
          body_fat_pct: 16.0,
          waist_cm: 82.0,
          bmi: 23.5
        },
        {
          id: 'm2',
          user_id: 'user_123',
          date: '2026-01-15',
          weight_kg: 70.0,
          body_fat_pct: 15.5,
          waist_cm: 80.0,
          bmi: 22.9
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockMetrics),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getBodyMetricsTrend('user_123', '30d');

      expect(result).toHaveLength(2);
      expect(result[0].weight_kg).toBe(72.0);
      expect(result[1].weight_kg).toBe(70.0);
    });

    it('should calculate BMI correctly', async () => {
      const mockMetrics = [
        {
          id: 'm1',
          user_id: 'user_123',
          date: '2026-01-15',
          weight_kg: 70.0,
          height_cm: 175.0,
          body_fat_pct: 15.5,
          waist_cm: 80.0
        }
      ];

      const mockDb = {
        all: jest.fn().mockResolvedValue(mockMetrics),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getBodyMetricsTrend('user_123', '30d');

      // BMI = weight(kg) / height(m)^2 = 70 / (1.75)^2 = 22.86
      expect(result[0].bmi).toBeCloseTo(22.86, 1);
    });

    it('should return empty array when no metrics data', async () => {
      const mockDb = {
        all: jest.fn().mockResolvedValue([]),
        get: jest.fn()
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getBodyMetricsTrend('user_123', '30d');

      expect(result).toEqual([]);
    });
  });
});
