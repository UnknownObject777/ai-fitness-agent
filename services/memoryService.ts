import { getSemanticMemory, saveSemanticMemory, getEpisodicMemories } from './dbService';

export interface WorkingMemory {
  sessionId: string | null;
  activeExerciseIndex?: number;
  currentSetNumber?: number;
  recentUserMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface UserProfile {
  goals: string[];
  weakPoints: string[];
  preferredStyle: string;
  injuryHistory: string[];
}

export interface WeeklyTrainingStats {
  weekId: string;
  startDate: string;
  endDate: string;
  totalWorkouts: number;
  muscleGroupVolume: Record<string, {
    totalSets: number;
    totalReps: number;
    totalVolumeLoad: number;
    workouts: string[];
  }>;
  exerciseRecords: Record<string, {
    bestWeight: number;
    bestReps: number;
    totalSets: number;
  }>;
}

export interface SemanticMemory {
  userId: string;
  userProfile: UserProfile;
  strengthModel: Record<string, any>;
  weeklyTrainingStats?: Record<string, WeeklyTrainingStats>;
  updatedAt: string;
}

export interface AgentContext {
  semanticMemory: SemanticMemory;
  recentEpisodes: any[];
  workingMemory: WorkingMemory;
  userMessage: string;
}

const DEFAULT_USER_ID = 'user_1';

export async function getOrInitSemanticMemory(userId: string = DEFAULT_USER_ID): Promise<SemanticMemory> {
  const existing = await getSemanticMemory(userId);
  if (existing) return existing;

  const initial: SemanticMemory = {
    userId,
    userProfile: {
      goals: [],
      weakPoints: [],
      preferredStyle: '未知',
      injuryHistory: [],
    },
    strengthModel: {},
    updatedAt: new Date().toISOString(),
  };
  await saveSemanticMemory(userId, initial);
  return initial;
}

export async function updateSemanticMemory(updates: Partial<UserProfile>, userId: string = DEFAULT_USER_ID): Promise<SemanticMemory> {
  const memory = await getOrInitSemanticMemory(userId);
  
  if (updates.goals) {
    memory.userProfile.goals = Array.from(new Set([...memory.userProfile.goals, ...updates.goals]));
  }
  if (updates.weakPoints) {
    memory.userProfile.weakPoints = Array.from(new Set([...memory.userProfile.weakPoints, ...updates.weakPoints]));
  }
  if (updates.injuryHistory) {
    memory.userProfile.injuryHistory = Array.from(new Set([...memory.userProfile.injuryHistory, ...updates.injuryHistory]));
  }
  if (updates.preferredStyle) {
    memory.userProfile.preferredStyle = updates.preferredStyle;
  }

  memory.updatedAt = new Date().toISOString();
  await saveSemanticMemory(userId, memory);
  return memory;
}

export async function buildAgentContext(
  userMessage: string, 
  sessionId: string | null,
  recentMessages: any[] = []
): Promise<AgentContext> {
  const semanticMemory = await getOrInitSemanticMemory();
  const recentEpisodes = await getEpisodicMemories(DEFAULT_USER_ID, 10);
  
  const workingMemory: WorkingMemory = {
    sessionId,
    recentUserMessages: recentMessages.slice(-5),
  };

  return { 
    semanticMemory, 
    recentEpisodes: recentEpisodes.map(e => ({
      date: e.entryDate,
      intent: e.intent,
      summary: formatEpisodeSummary(e)
    })), 
    workingMemory, 
    userMessage 
  };
}

function formatEpisodeSummary(episode: any): string {
  const { intent, data } = episode;
  if (intent === 'log_food') {
    return `饮食日志：吃了 ${data.food_name}，约 ${data.calories} 大卡`;
  }
  if (intent === 'log_exercise') {
    return `运动日志：${data.exercise_name}，时长 ${data.duration_minutes} 分钟`;
  }
  if (intent === 'log_strength_workout') {
    return `力量训练：${data.workout_name}，时长 ${data.duration_minutes} 分钟`;
  }
  if (intent === 'log_measurement') {
    return `体测记录：记录了 ${data.weight_kg ? `体重 ${data.weight_kg}kg` : '身体数据'}`;
  }
  return `记录了 ${intent}`;
}

export function formatContextAsSystemPrompt(ctx: AgentContext): string {
  return `
## 你对用户的记忆 (Long-term & Short-term Memory)

### 用户画像 (Semantic Memory)
- 训练目标：${ctx.semanticMemory.userProfile.goals.join('、') || '未设置'}
- 已知弱点：${ctx.semanticMemory.userProfile.weakPoints.join('、') || '无'}
- 偏好风格：${ctx.semanticMemory.userProfile.preferredStyle}
- 受伤历史：${ctx.semanticMemory.userProfile.injuryHistory.join('、') || '无'}

### 最近活动记录 (Episodic Memory)
${ctx.recentEpisodes.map((e) => `- [${e.date}] ${e.summary}`).join('\n') || '暂无近期记录'}

### 当前对话概要 (Working Memory)
- 会话ID: ${ctx.workingMemory.sessionId || '新会话'}
- 最近交流摘要: ${ctx.workingMemory.recentUserMessages.map(m => '[' + m.role + '] ' + m.content.slice(0, 50)).join(' | ')}

请结合以上背景信息，为用户提供极其个性化、专业且有温度的健身/营养建议。如果发现用户最近有进步，请给予鼓励；如果用户提到受伤或不适，请优先关注安全。
`.trim();
}

// Exercise to muscle group mapping
const EXERCISE_MUSCLE_MAP: Record<string, { primary: string[]; secondary: string[] }> = {
  "卧推": { primary: ["胸部"], secondary: ["三头肌", "肩部前束"] },
  "杠铃卧推": { primary: ["胸部"], secondary: ["三头肌", "肩部前束"] },
  "哑铃卧推": { primary: ["胸部"], secondary: ["三头肌", "肩部"] },
  "深蹲": { primary: ["股四头肌", "臀部"], secondary: ["腘绳肌", "小腿", "核心"] },
  "杠铃深蹲": { primary: ["股四头肌", "臀部"], secondary: ["腘绳肌", "小腿", "核心"] },
  "硬拉": { primary: ["背部", "腘绳肌", "臀部"], secondary: ["前臂", "斜方肌", "核心"] },
  "杠铃硬拉": { primary: ["背部", "腘绳肌", "臀部"], secondary: ["前臂", "斜方肌", "核心"] },
  "推举": { primary: ["肩部"], secondary: ["三头肌", "斜方肌", "核心"] },
  "杠铃推举": { primary: ["肩部"], secondary: ["三头肌", "斜方肌", "核心"] },
  "哑铃推举": { primary: ["肩部"], secondary: ["三头肌"] },
  "引体向上": { primary: ["背部", "背阔肌"], secondary: ["二头肌", "核心"] },
  "划船": { primary: ["背部", "背阔肌"], secondary: ["二头肌", "后束"] },
  "杠铃划船": { primary: ["背部", "背阔肌"], secondary: ["二头肌", "后束"] },
  "哑铃划船": { primary: ["背部", "背阔肌"], secondary: ["二头肌"] },
  "臂屈伸": { primary: ["三头肌"], secondary: ["胸部", "肩部前束"] },
  "弯举": { primary: ["二头肌"], secondary: ["前臂"] },
  "杠铃弯举": { primary: ["二头肌"], secondary: ["前臂"] },
  "哑铃弯举": { primary: ["二头肌"], secondary: ["前臂"] },
};

export function analyzeMuscleGroups(workoutData: any): {
  muscleGroups: Record<string, { sets: number; volumeLoad: number }>;
  totalVolume: number;
  totalSets: number;
} {
  const muscleGroups: Record<string, { sets: number; volumeLoad: number }> = {};
  let totalVolume = 0;
  let totalSets = 0;

  for (const exercise of workoutData.exercises || []) {
    const mapping = EXERCISE_MUSCLE_MAP[exercise.name] ||
      { primary: exercise.muscle_groups || ["未知"], secondary: [] };

    for (const set of exercise.sets || []) {
      const setVolume = (set.weight || 0) * (set.reps || 0);
      totalVolume += setVolume;
      totalSets += 1;

      for (const muscle of mapping.primary) {
        if (!muscleGroups[muscle]) muscleGroups[muscle] = { sets: 0, volumeLoad: 0 };
        muscleGroups[muscle].sets += 1;
        muscleGroups[muscle].volumeLoad += setVolume;
      }

      for (const muscle of mapping.secondary) {
        if (!muscleGroups[muscle]) muscleGroups[muscle] = { sets: 0, volumeLoad: 0 };
        muscleGroups[muscle].sets += 0.5;
        muscleGroups[muscle].volumeLoad += setVolume * 0.5;
      }
    }
  }

  return { muscleGroups, totalVolume, totalSets };
}

export async function aggregateWeeklyStats(
  userId: string,
  weekId: string,
  workoutRecords: any[]
): Promise<WeeklyTrainingStats> {
  const [year, week] = weekId.split('-W').map(Number);
  const startDate = getWeekStartDate(year, week);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const muscleGroupVolume: Record<string, any> = {};
  const exerciseRecords: Record<string, any> = {};

  for (const record of workoutRecords) {
    const analysis = analyzeMuscleGroups(record.data);

    for (const [muscle, data] of Object.entries(analysis.muscleGroups)) {
      if (!muscleGroupVolume[muscle]) {
        muscleGroupVolume[muscle] = {
          totalSets: 0,
          totalReps: 0,
          totalVolumeLoad: 0,
          workouts: []
        };
      }
      muscleGroupVolume[muscle].totalSets += data.sets;
      muscleGroupVolume[muscle].totalVolumeLoad += data.volumeLoad;
      muscleGroupVolume[muscle].workouts.push(record.id);
    }

    for (const exercise of record.data.exercises || []) {
      const name = exercise.name;
      if (!exerciseRecords[name]) {
        exerciseRecords[name] = {
          bestWeight: 0,
          bestReps: 0,
          totalSets: 0
        };
      }

      for (const set of exercise.sets || []) {
        exerciseRecords[name].totalSets += 1;
        if ((set.weight || 0) > exerciseRecords[name].bestWeight) {
          exerciseRecords[name].bestWeight = set.weight;
          exerciseRecords[name].bestReps = set.reps;
        }
      }
    }
  }

  return {
    weekId,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalWorkouts: workoutRecords.length,
    muscleGroupVolume,
    exerciseRecords
  };
}

function getWeekStartDate(year: number, week: number): Date {
  const januaryFirst = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - januaryFirst.getDay() + 1;
  const weekStart = new Date(year, 0, daysOffset);
  return weekStart;
}

// Helper function to get week number from date
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper function to merge weekly stats
export function mergeWeeklyStats(existing: any, newStats: any) {
  existing.totalWorkouts += newStats.totalWorkouts;

  for (const [muscle, data] of Object.entries(newStats.muscleGroupVolume)) {
    if (!existing.muscleGroupVolume[muscle]) {
      existing.muscleGroupVolume[muscle] = data;
    } else {
      existing.muscleGroupVolume[muscle].totalSets += (data as any).totalSets;
      existing.muscleGroupVolume[muscle].totalVolumeLoad += (data as any).totalVolumeLoad;
      existing.muscleGroupVolume[muscle].workouts.push(...(data as any).workouts);
    }
  }

  for (const [exercise, data] of Object.entries(newStats.exerciseRecords)) {
    if (!existing.exerciseRecords[exercise]) {
      existing.exerciseRecords[exercise] = data;
    } else {
      const existingRecord = existing.exerciseRecords[exercise];
      existingRecord.totalSets += (data as any).totalSets;
      if ((data as any).bestWeight > existingRecord.bestWeight) {
        existingRecord.bestWeight = (data as any).bestWeight;
        existingRecord.bestReps = (data as any).bestReps;
      }
    }
  }
}

