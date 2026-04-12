import { ulid } from 'ulidx';
import type { EpisodicMemory } from './types';

const STORAGE_KEY = 'fitmind-episodic-memories';

export function getEpisodicMemories(): EpisodicMemory[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse episodic memories', e);
    }
  }
  return [];
}

export function saveEpisodicMemory(memory: EpisodicMemory): void {
  const memories = getEpisodicMemories();
  memories.push(memory);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

export function simulateWorkout(): EpisodicMemory {
  const id = ulid();
  const exercises = ['卧推', '深蹲', '硬拉', '引体向上', '肩推'];
  const selected = exercises[Math.floor(Math.random() * exercises.length)];
  
  const memory: EpisodicMemory = {
    id,
    userId: 'local',
    sessionId: ulid(),
    date: new Date().toISOString().split('T')[0],
    summary: `完成了以${selected}为主的训练，状态良好，力量有所提升。`,
    tags: [selected, 'strength', 'completed'],
    metrics: {
      totalVolume: Math.floor(Math.random() * 5000) + 2000,
      avgRPE: 7.5 + Math.random(),
      completionRate: 1.0,
      prsAchieved: Math.random() > 0.7 ? [selected] : [],
    },
    recoverySignals: {
      sleepHours: 7 + Math.random(),
      muscleSoreness: Math.floor(Math.random() * 3) + 1,
      energyLevel: Math.floor(Math.random() * 2) + 4,
    },
    createdAt: new Date().toISOString(),
  };
  
  saveEpisodicMemory(memory);
  return memory;
}

export function getRecentEpisodes(days: number): EpisodicMemory[] {
  const memories = getEpisodicMemories();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return memories
    .filter(m => new Date(m.date) >= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Simple keyword search for MVP instead of vector search
export function searchSimilarEpisodes(query: string, topK = 3): EpisodicMemory[] {
  const memories = getEpisodicMemories();
  const keywords = query.toLowerCase().split(/\s+/);
  
  const scored = memories.map(m => {
    let score = 0;
    const content = (m.summary + ' ' + m.tags.join(' ')).toLowerCase();
    keywords.forEach(k => {
      if (content.includes(k)) score++;
    });
    return { memory: m, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.memory);
}
