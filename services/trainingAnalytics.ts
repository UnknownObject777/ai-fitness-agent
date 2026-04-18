import { getDb } from './dbService.js';

export interface WorkoutTrendPoint {
  date: string;
  totalVolume: number;       // kg (sets × reps × weight)
  workoutCount: number;
  durationMin: number;
  avgRpe: number | null;
  muscleGroups: string[];
}

export interface MuscleGroupDistribution {
  group: string;
  volume: number;
  sessions: number;
}

export interface StrengthProgressPoint {
  date: string;
  exercise: string;
  estimated1RM: number;
  bestSet: { weight: number; reps: number };
}

export interface WorkoutTrendsResult {
  trendPoints: WorkoutTrendPoint[];
  muscleDistribution: MuscleGroupDistribution[];
  strengthProgress: StrengthProgressPoint[];
  summary: {
    totalWorkouts: number;
    totalVolume: number;
    avgWorkoutsPerWeek: number;
    mostTrainedGroup: string;
    totalDurationMin: number;
  };
}

// Epley formula: 1RM = weight * (1 + reps/30)
function estimateOneRM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// Map exercise names to muscle groups (Chinese + English)
const EXERCISE_MUSCLE_MAP: Record<string, string> = {
  // Chest
  '卧推': '胸部', '哑铃飞鸟': '胸部', '上斜卧推': '胸部', '下斜卧推': '胸部',
  '俯卧撑': '胸部', 'bench press': '胸部', 'chest fly': '胸部', 'push-up': '胸部',
  // Back
  '引体向上': '背部', '划船': '背部', '高位下拉': '背部', '硬拉': '背部',
  '坐姿划船': '背部', 'pull-up': '背部', 'row': '背部', 'deadlift': '背部',
  'lat pulldown': '背部',
  // Legs
  '深蹲': '腿部', '腿举': '腿部', '弓步蹲': '腿部', '腿屈伸': '腿部',
  '腿弯举': '腿部', '小腿提踵': '腿部', 'squat': '腿部', 'leg press': '腿部',
  'lunge': '腿部', 'leg curl': '腿部', 'calf raise': '腿部',
  // Shoulders
  '肩推': '肩部', '侧平举': '肩部', '前平举': '肩部', '面拉': '肩部',
  'shoulder press': '肩部', 'lateral raise': '肩部', 'face pull': '肩部',
  // Arms
  '弯举': '手臂', '三头绳索下压': '手臂', '锤式弯举': '手臂', '臂屈伸': '手臂',
  'bicep curl': '手臂', 'tricep': '手臂', 'curl': '手臂',
  // Core
  '卷腹': '核心', '平板支撑': '核心', '俄罗斯转体': '核心', '腿举核心': '核心',
  'plank': '核心', 'crunch': '核心', 'ab': '核心',
};

function detectMuscleGroup(exerciseName: string): string {
  const lower = exerciseName.toLowerCase();
  for (const [key, group] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (lower.includes(key.toLowerCase())) return group;
  }
  // Heuristic from workout_name
  if (lower.includes('上肢') || lower.includes('胸') || lower.includes('推')) return '胸部/肩部';
  if (lower.includes('下肢') || lower.includes('腿')) return '腿部';
  if (lower.includes('背') || lower.includes('拉')) return '背部';
  return '综合';
}

function getDaysBack(range: string): number {
  const map: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180 };
  return map[range] || 30;
}

export async function getWorkoutTrends(
  userId: string = 'user_1',
  range: string = '30d'
): Promise<WorkoutTrendsResult> {
  const db = await getDb();
  const days = getDaysBack(range);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Fetch strength workout records
  const rows = (await db.all(
    `SELECT id, entry_date, timestamp, data_json
     FROM activity_records
     WHERE user_id = ? AND intent = 'log_strength_workout' AND entry_date >= ?
     ORDER BY entry_date ASC`,
    userId, since
  )) as Array<{ id: string; entry_date: string; timestamp: string; data_json: string }>;

  // Also get cardio
  const cardioRows = (await db.all(
    `SELECT id, entry_date, timestamp, data_json
     FROM activity_records
     WHERE user_id = ? AND intent = 'log_exercise' AND entry_date >= ?
     ORDER BY entry_date ASC`,
    userId, since
  )) as Array<{ id: string; entry_date: string; timestamp: string; data_json: string }>;

  // Build per-day map
  const dayMap = new Map<string, WorkoutTrendPoint>();

  const ensureDay = (date: string): WorkoutTrendPoint => {
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        totalVolume: 0,
        workoutCount: 0,
        durationMin: 0,
        avgRpe: null,
        muscleGroups: []
      });
    }
    return dayMap.get(date)!;
  };

  // Muscle distribution accumulator
  const muscleMap = new Map<string, { volume: number; sessions: number }>();
  const strengthProgressMap = new Map<string, { date: string; oneRM: number; weight: number; reps: number }[]>();

  for (const row of rows) {
    let data: any = {};
    try { data = JSON.parse(row.data_json); } catch { /* skip */ }

    const day = ensureDay(row.entry_date);
    day.workoutCount++;
    day.durationMin += data.duration_minutes || 0;

    if (typeof data.rpe === 'number') {
      day.avgRpe = day.avgRpe === null ? data.rpe : (day.avgRpe + data.rpe) / 2;
    }

    // Detect muscle group from workout_name
    const workoutMuscle = detectMuscleGroup(data.workout_name || '');

    const exercises: any[] = Array.isArray(data.exercises) ? data.exercises : [];
    for (const ex of exercises) {
      const exName = ex.exercise_name || ex.name || '';
      const muscle = detectMuscleGroup(exName) || workoutMuscle;
      if (!day.muscleGroups.includes(muscle)) day.muscleGroups.push(muscle);

      // Accumulate muscle distribution
      const sets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
      let exVolume = 0;
      for (const set of sets) {
        const weight = Number(set.weight_kg || set.weight || 0);
        const reps = Number(set.reps || 0);
        exVolume += weight * reps;

        // Track 1RM per exercise
        if (weight > 0 && reps > 0) {
          const oneRM = estimateOneRM(weight, reps);
          if (!strengthProgressMap.has(exName)) strengthProgressMap.set(exName, []);
          const existing = strengthProgressMap.get(exName)!;
          const dayEntry = existing.find(e => e.date === row.entry_date);
          if (!dayEntry || oneRM > dayEntry.oneRM) {
            const filtered = existing.filter(e => e.date !== row.entry_date);
            filtered.push({ date: row.entry_date, oneRM, weight, reps });
            strengthProgressMap.set(exName, filtered);
          }
        }
      }

      day.totalVolume += exVolume;

      if (!muscleMap.has(muscle)) muscleMap.set(muscle, { volume: 0, sessions: 0 });
      const muscleEntry = muscleMap.get(muscle)!;
      muscleEntry.volume += exVolume;
      muscleEntry.sessions++;
    }

    // If no exercises breakdown, still count day volume from workout_log table
    if (exercises.length === 0) {
      if (!day.muscleGroups.includes(workoutMuscle)) day.muscleGroups.push(workoutMuscle);
      if (!muscleMap.has(workoutMuscle)) muscleMap.set(workoutMuscle, { volume: 0, sessions: 0 });
      muscleMap.get(workoutMuscle)!.sessions++;
    }
  }

  // Also add cardio days
  for (const row of cardioRows) {
    let data: any = {};
    try { data = JSON.parse(row.data_json); } catch { /* skip */ }
    const day = ensureDay(row.entry_date);
    day.workoutCount++;
    day.durationMin += data.duration_minutes || 0;
    if (!day.muscleGroups.includes('有氧')) day.muscleGroups.push('有氧');
  }

  const trendPoints = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const muscleDistribution: MuscleGroupDistribution[] = Array.from(muscleMap.entries())
    .map(([group, val]) => ({ group, ...val }))
    .sort((a, b) => b.volume - a.volume);

  // Build strength progress list (top exercises by most data points)
  const strengthProgress: StrengthProgressPoint[] = [];
  for (const [exercise, entries] of strengthProgressMap.entries()) {
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
    for (const e of sorted) {
      strengthProgress.push({
        date: e.date,
        exercise,
        estimated1RM: e.oneRM,
        bestSet: { weight: e.weight, reps: e.reps }
      });
    }
  }

  const totalVolume = trendPoints.reduce((s, p) => s + p.totalVolume, 0);
  const totalDurationMin = trendPoints.reduce((s, p) => s + p.durationMin, 0);
  const totalWorkouts = trendPoints.reduce((s, p) => s + p.workoutCount, 0);
  const avgWorkoutsPerWeek = days > 0 ? Math.round((totalWorkouts / days) * 7 * 10) / 10 : 0;
  const mostTrainedGroup = muscleDistribution.length > 0 ? muscleDistribution[0].group : '—';

  return {
    trendPoints,
    muscleDistribution,
    strengthProgress,
    summary: {
      totalWorkouts,
      totalVolume: Math.round(totalVolume),
      avgWorkoutsPerWeek,
      mostTrainedGroup,
      totalDurationMin
    }
  };
}

export interface BodyMetricPoint {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  bmi: number | null;
}

export async function getBodyMetricsTrend(
  userId: string = 'user_1',
  range: string = '90d'
): Promise<BodyMetricPoint[]> {
  const db = await getDb();
  const days = getDaysBack(range);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const rows = (await db.all(
    `SELECT entry_date, data_json
     FROM activity_records
     WHERE user_id = ? AND intent = 'log_measurement' AND entry_date >= ?
     ORDER BY entry_date ASC`,
    userId, since
  )) as Array<{ entry_date: string; data_json: string }>;

  return rows.map(row => {
    let data: any = {};
    try { data = JSON.parse(row.data_json); } catch { /* skip */ }

    let weight = data.weight_kg || null;
    if (!weight && Array.isArray(data.measurements)) {
      const wm = data.measurements.find((m: any) => m.metric === 'weight');
      weight = wm?.value || null;
    }

    const bmi = weight ? Math.round((weight / Math.pow(1.70, 2)) * 10) / 10 : null;

    return {
      date: row.entry_date,
      weight_kg: weight,
      body_fat_pct: data.body_fat_pct || null,
      waist_cm: data.waist_cm || null,
      bmi
    };
  });
}
