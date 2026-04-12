import type { SemanticMemory } from './types';

const STORAGE_KEY = 'fitmind-semantic-memory';
const DEFAULT_USER_ID = 'local';

export function getSemanticMemory(): SemanticMemory {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse semantic memory', e);
    }
  }
  return createDefaultSemanticMemory();
}

export function saveSemanticMemory(memory: SemanticMemory): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

function createDefaultSemanticMemory(): SemanticMemory {
  return {
    userId: DEFAULT_USER_ID,
    userProfile: {
      goals: [],
      weakPoints: [],
      preferredStyle: '未知',
      injuryHistory: [],
      motivationPattern: '未知',
      preferredDays: [],
      averageSessionDuration: 60,
    },
    strengthModel: {},
    fatigueModel: {
      avgRecoveryDays: 1.5,
      optimalSessionsPerWeek: 4,
      highFatigueSignals: [],
      deloadTriggerConditions: [],
      lastDeloadDate: null,
    },
    planEffectiveness: {},
    updatedAt: new Date().toISOString(),
  };
}
