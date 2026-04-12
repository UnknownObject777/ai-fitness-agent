import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkingMemory } from './types';

interface WorkingMemoryStore extends WorkingMemory {
  setSession: (sessionId: string) => void;
  setActiveExercise: (index: number) => void;
  setCurrentSet: (setNumber: number) => void;
  setRestTimer: (seconds: number) => void;
  updateLastWeight: (exerciseId: string, weight: number) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  clearSession: () => void;
}

const initialState: WorkingMemory = {
  sessionId: null,
  activeExerciseIndex: 0,
  currentSetNumber: 1,
  restTimerSeconds: 0,
  lastSetWeightByExercise: {},
  recentUserMessages: [],
  sessionStartTime: null,
};

export const useWorkingMemory = create<WorkingMemoryStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (sessionId) =>
        set({ sessionId, sessionStartTime: new Date().toISOString() }),

      setActiveExercise: (index) =>
        set({ activeExerciseIndex: index, currentSetNumber: 1 }),

      setCurrentSet: (setNumber) => set({ currentSetNumber: setNumber }),

      setRestTimer: (seconds) => set({ restTimerSeconds: seconds }),

      updateLastWeight: (exerciseId, weight) =>
        set((state) => ({
          lastSetWeightByExercise: {
            ...state.lastSetWeightByExercise,
            [exerciseId]: weight,
          },
        })),

      addMessage: (role, content) =>
        set((state) => ({
          recentUserMessages: [
            ...state.recentUserMessages.slice(-9), // Keep last 10
            { role, content },
          ],
        })),

      clearSession: () => set(initialState),
    }),
    {
      name: 'fitmind-working-memory',
    }
  )
);
