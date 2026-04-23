/**
 * Test fixtures for workout-related data
 */

export const sampleWorkoutLog = {
  id: 'workout_123',
  user_id: 'user_123',
  date: '2026-01-15',
  exercise_name: 'Bench Press',
  muscle_group: 'chest',
  sets: 4,
  reps: 10,
  weight_kg: 80.0,
  rpe: 8,
  notes: 'Felt strong today',
  created_at: '2026-01-15T08:30:00Z'
};

export const sampleWorkoutTrendPoint = {
  date: '2026-01-15',
  totalVolume: 3200, // kg (sets × reps × weight)
  workoutCount: 1,
  durationMin: 60,
  avgRpe: 8,
  muscleGroups: ['chest']
};

export const sampleStrengthProgressPoint = {
  date: '2026-01-15',
  exercise: 'Bench Press',
  estimated1RM: 100, // kg
  bestSet: { weight: 80, reps: 10 }
};

export const sampleMuscleDistribution = {
  group: 'chest',
  volume: 3200,
  sessions: 1
};

export const exerciseMuscleMap: Record<string, string> = {
  '卧推': 'chest',
  'bench press': 'chest',
  '俯卧撑': 'chest',
  '引体向上': 'back',
  '划船': 'back',
  'deadlift': 'back',
  '深蹲': 'legs',
  'squat': 'legs',
  'lunge': 'legs',
  '肩推': 'shoulders',
  'shoulder press': 'shoulders',
  '弯举': 'arms',
  'curl': 'arms',
  'tricep': 'arms',
  '卷腹': 'core',
  'plank': 'core',
  'crunch': 'core'
};
