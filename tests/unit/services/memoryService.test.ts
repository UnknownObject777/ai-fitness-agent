/**
 * Unit tests for memoryService
 */

import {
  getOrInitSemanticMemory,
  updateSemanticMemory,
  buildAgentContext,
  formatContextAsSystemPrompt,
  analyzeMuscleGroups,
  aggregateWeeklyStats,
  getWeekNumber,
  mergeWeeklyStats,
  type SemanticMemory,
  type UserProfile,
  type WeeklyTrainingStats
} from '../../../services/memoryService';

// Mock database
jest.mock('../../../services/dbService', () => ({
  getDb: jest.fn()
}));

import { getDb } from '../../../services/dbService';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe('memoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrInitSemanticMemory', () => {
    it('should return existing semantic memory', async () => {
      const mockMemory: SemanticMemory = {
        userId: 'user_123',
        userProfile: {
          goals: ['build muscle', 'lose fat'],
          weakPoints: ['core strength'],
          preferredStyle: 'strength training',
          injuryHistory: ['shoulder impingement']
        },
        strengthModel: {
          benchPress: { estimated1RM: 100, lastTested: '2026-01-01' }
        },
        weeklyTrainingStats: {
          '2026-W03': {
            weekId: '2026-W03',
            startDate: '2026-01-15',
            endDate: '2026-01-21',
            totalWorkouts: 4,
            muscleGroupVolume: { chest: 10000, back: 8000 },
            exerciseRecords: {}
          }
        },
        updatedAt: '2026-01-15T10:00:00Z'
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            memory_data: JSON.stringify(mockMemory)
          })
        })
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getOrInitSemanticMemory('user_123');

      expect(result.userId).toBe('user_123');
      expect(result.userProfile.goals).toContain('build muscle');
      expect(result.userProfile.injuryHistory).toContain('shoulder impingement');
    });

    it('should initialize new memory if not exists', async () => {
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null)
        })
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const result = await getOrInitSemanticMemory('user_123');

      expect(result.userId).toBe('user_123');
      expect(result.userProfile).toBeDefined();
      expect(result.userProfile.goals).toEqual([]);
      expect(result.userProfile.injuryHistory).toEqual([]);
      expect(result.strengthModel).toEqual({});
      expect(result.weeklyTrainingStats).toEqual({});
    });
  });

  describe('updateSemanticMemory', () => {
    it('should update user profile', async () => {
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          run: jest.fn()
        })
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const updates: Partial<SemanticMemory> = {
        userProfile: {
          goals: ['strength', 'endurance'],
          weakPoints: ['flexibility'],
          preferredStyle: 'hybrid',
          injuryHistory: []
        }
      };

      const result = await updateSemanticMemory(updates, 'user_123');

      expect(result.userProfile.goals).toContain('strength');
      expect(result.userProfile.preferredStyle).toBe('hybrid');
    });

    it('should merge weekly training stats', async () => {
      const existingMemory: SemanticMemory = {
        userId: 'user_123',
        userProfile: { goals: [], weakPoints: [], preferredStyle: '', injuryHistory: [] },
        strengthModel: {},
        weeklyTrainingStats: {
          '2026-W03': {
            weekId: '2026-W03',
            startDate: '2026-01-15',
            endDate: '2026-01-21',
            totalWorkouts: 3,
            muscleGroupVolume: { chest: 5000 },
            exerciseRecords: {}
          }
        },
        updatedAt: '2026-01-15T10:00:00Z'
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            memory_data: JSON.stringify(existingMemory)
          }),
          run: jest.fn()
        })
      };
      mockedGetDb.mockResolvedValue(mockDb as any);

      const updates: Partial<SemanticMemory> = {
        weeklyTrainingStats: {
          '2026-W03': {
            weekId: '2026-W03',
            startDate: '2026-01-15',
            endDate: '2026-01-21',
            totalWorkouts: 4,
            muscleGroupVolume: { chest: 8000, back: 6000 },
            exerciseRecords: {}
          }
        }
      };

      const result = await updateSemanticMemory(updates, 'user_123');

      // Should merge stats for the same week
      expect(result.weeklyTrainingStats['2026-W03'].totalWorkouts).toBe(4);
      expect(result.weeklyTrainingStats['2026-W03'].muscleGroupVolume.chest).toBe(8000);
      expect(result.weeklyTrainingStats['2026-W03'].muscleGroupVolume.back).toBe(6000);
    });
  });

  describe('analyzeMuscleGroups', () => {
    it('should analyze muscle group balance', () => {
      const workoutData = {
        exercises: [
          { name: 'Bench Press', muscleGroup: 'chest', volume: 5000 },
          { name: 'Squat', muscleGroup: 'legs', volume: 8000 },
          { name: 'Deadlift', muscleGroup: 'back', volume: 6000 }
        ]
      };

      const result = analyzeMuscleGroups(workoutData);

      expect(result.totalVolume).toBe(19000);
      expect(result.muscleGroups).toContain('chest');
      expect(result.muscleGroups).toContain('legs');
      expect(result.muscleGroups).toContain('back');
      expect(result.balanceRatios).toBeDefined();
    });

    it('should identify imbalances', () => {
      const workoutData = {
        exercises: [
          { name: 'Bench Press', muscleGroup: 'chest', volume: 10000 },
          { name: 'Row', muscleGroup: 'back', volume: 3000 }
        ]
      };

      const result = analyzeMuscleGroups(workoutData);

      // Chest volume is more than 2x back volume - should flag imbalance
      expect(result.imbalances).toBeDefined();
      expect(result.imbalances.length).toBeGreaterThan(0);
    });
  });

  describe('getWeekNumber', () => {
    it('should return correct week number', () => {
      const date = new Date('2026-01-15');
      const weekNumber = getWeekNumber(date);

      expect(typeof weekNumber).toBe('number');
      expect(weekNumber).toBeGreaterThan(0);
      expect(weekNumber).toBeLessThanOrEqual(53);
    });

    it('should return consistent week numbers for same week', () => {
      const date1 = new Date('2026-01-15'); // Wednesday
      const date2 = new Date('2026-01-18'); // Saturday

      const week1 = getWeekNumber(date1);
      const week2 = getWeekNumber(date2);

      expect(week1).toBe(week2);
    });
  });

  describe('aggregateWeeklyStats', () => {
    it('should aggregate weekly workout stats', () => {
      const userId = 'user_123';
      const weekId = '2026-W03';
      const records = [
        {
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 4,
          reps: 10,
          weight_kg: 80.0,
          date: '2026-01-15'
        },
        {
          exercise_name: 'Squat',
          muscle_group: 'legs',
          sets: 3,
          reps: 8,
          weight_kg: 100.0,
          date: '2026-01-16'
        }
      ];

      const result = aggregateWeeklyStats(userId, weekId, records);

      expect(result.weekId).toBe(weekId);
      expect(result.totalWorkouts).toBe(2);
      expect(result.muscleGroupVolume).toHaveProperty('chest');
      expect(result.muscleGroupVolume).toHaveProperty('legs');
      expect(result.exerciseRecords).toHaveProperty('Bench Press');
      expect(result.exerciseRecords).toHaveProperty('Squat');
    });

    it('should calculate volume correctly for exercises', () => {
      const userId = 'user_123';
      const weekId = '2026-W03';
      const records = [
        {
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 4,
          reps: 10,
          weight_kg: 80.0,
          date: '2026-01-15'
        }
      ];

      const result = aggregateWeeklyStats(userId, weekId, records);

      // Volume = sets × reps × weight = 4 × 10 × 80 = 3200
      expect(result.muscleGroupVolume.chest).toBe(3200);
      expect(result.exerciseRecords['Bench Press'].totalVolume).toBe(3200);
      expect(result.exerciseRecords['Bench Press'].bestSet.weight).toBe(80);
      expect(result.exerciseRecords['Bench Press'].bestSet.reps).toBe(10);
    });

    it('should track multiple sets of same exercise', () => {
      const userId = 'user_123';
      const weekId = '2026-W03';
      const records = [
        {
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 2,
          reps: 10,
          weight_kg: 80.0,
          date: '2026-01-15'
        },
        {
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 2,
          reps: 8,
          weight_kg: 85.0,
          date: '2026-01-15'
        }
      ];

      const result = aggregateWeeklyStats(userId, weekId, records);

      // Total volume: (2×10×80) + (2×8×85) = 1600 + 1360 = 2960
      expect(result.exerciseRecords['Bench Press'].totalVolume).toBe(2960);
      expect(result.exerciseRecords['Bench Press'].setCount).toBe(4);
    });
  });

  describe('mergeWeeklyStats', () => {
    it('should merge two weekly stats objects', () => {
      const existing: WeeklyTrainingStats = {
        weekId: '2026-W03',
        startDate: '2026-01-15',
        endDate: '2026-01-21',
        totalWorkouts: 2,
        muscleGroupVolume: { chest: 5000, back: 4000 },
        exerciseRecords: {
          'Bench Press': {
            totalVolume: 5000,
            setCount: 4,
            bestSet: { weight: 80, reps: 10 }
          }
        }
      };

      const newStats: WeeklyTrainingStats = {
        weekId: '2026-W03',
        startDate: '2026-01-15',
        endDate: '2026-01-21',
        totalWorkouts: 1,
        muscleGroupVolume: { legs: 6000 },
        exerciseRecords: {
          'Squat': {
            totalVolume: 6000,
            setCount: 5,
            bestSet: { weight: 100, reps: 8 }
          }
        }
      };

      mergeWeeklyStats(existing, newStats);

      expect(existing.totalWorkouts).toBe(3);
      expect(existing.muscleGroupVolume.chest).toBe(5000);
      expect(existing.muscleGroupVolume.back).toBe(4000);
      expect(existing.muscleGroupVolume.legs).toBe(6000);
      expect(existing.exerciseRecords['Bench Press']).toBeDefined();
      expect(existing.exerciseRecords['Squat']).toBeDefined();
    });
  });
});
