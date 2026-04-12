// ── 工作记忆 ──────────────────────────────────────────────
export interface WorkingMemory {
  sessionId: string | null;
  activeExerciseIndex: number;
  currentSetNumber: number;
  restTimerSeconds: number;
  lastSetWeightByExercise: Record<string, number>; // exerciseId → last weight
  recentUserMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionStartTime: string | null;
}

// ── 情节记忆 ──────────────────────────────────────────────
export interface EpisodicMemory {
  id: string;
  userId: string;
  sessionId: string | null;
  date: string;
  summary: string;
  tags: string[];
  metrics: {
    totalVolume: number;
    avgRPE: number;
    completionRate: number;
    prsAchieved: string[];
  };
  recoverySignals: {
    sleepHours?: number;
    muscleSoreness?: number;
    energyLevel?: number;
    userNote?: string;
  };
  createdAt: string;
}

// ── 语义记忆 ──────────────────────────────────────────────
export interface UserProfile {
  goals: string[];
  weakPoints: string[];
  preferredStyle: string;
  injuryHistory: string[];
  motivationPattern: string;
  preferredDays: string[];
  averageSessionDuration: number;
}

export interface ExerciseStrengthEntry {
  estimated1RM: number;
  trend: 'rising' | 'plateau' | 'declining';
  plateauWeeks: number;
  lastPRDate: string;
  lastUpdated: string;
  decayApplied: boolean;
}

export interface FatigueModel {
  avgRecoveryDays: number;
  optimalSessionsPerWeek: number;
  highFatigueSignals: string[];
  deloadTriggerConditions: string[];
  lastDeloadDate: string | null;
}

export interface PlanEffectivenessEntry {
  planId: string;
  adherenceRate: number;
  goalProgressRate: number;
  userSatisfactionScore: number;
  weeksCompleted: number;
  recommendation: 'continue' | 'adjust' | 'switch';
}

export interface SemanticMemory {
  userId: string;
  userProfile: UserProfile;
  strengthModel: Record<string, ExerciseStrengthEntry>;
  fatigueModel: FatigueModel;
  planEffectiveness: Record<string, PlanEffectivenessEntry>;
  updatedAt: string;
}

// ── Agent 上下文 ──────────────────────────────────────────
export interface AgentContext {
  semanticMemory: SemanticMemory;
  relevantEpisodes: EpisodicMemory[];
  recentEpisodes: EpisodicMemory[];
  workingMemory: WorkingMemory;
  userMessage: string;
}

export type Provider = 'gemini' | 'openai';

export interface ApiConfig {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}
