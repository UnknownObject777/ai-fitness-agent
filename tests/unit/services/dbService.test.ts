/**
 * Unit tests for dbService
 */

import {
  getDb,
  saveRecord,
  getHistory,
  getSessionMessages,
  listChatSessions,
  addChatMessage,
  updateActivityRecord,
  deleteActivityRecord
} from '../../../services/dbService';

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      get: jest.fn().mockReturnValue(null),
      all: jest.fn().mockReturnValue([])
    }),
    close: jest.fn()
  }));
});

describe('dbService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDb', () => {
    it('should return database instance', async () => {
      const db = await getDb();
      expect(db).toBeDefined();
      expect(db.prepare).toBeDefined();
    });
  });

  describe('saveRecord', () => {
    it('should save workout log record', async () => {
      const intent = 'log_strength_workout';
      const data = {
        exercise_name: 'Bench Press',
        muscle_group: 'chest',
        sets: 4,
        reps: 10,
        weight_kg: 80.0,
        rpe: 8
      };
      const entryDate = '2026-01-15';

      const result = await saveRecord(intent, data, entryDate);

      expect(result).toBeDefined();
    });

    it('should save food log record', async () => {
      const intent = 'log_food';
      const data = {
        food_name: 'Grilled Chicken Salad',
        calories: 450,
        protein_g: 35.0,
        carbs_g: 25.0,
        fat_g: 20.0,
        meal_type: 'lunch'
      };
      const entryDate = '2026-01-15';

      const result = await saveRecord(intent, data, entryDate);

      expect(result).toBeDefined();
    });

    it('should save body metrics record', async () => {
      const intent = 'log_measurement';
      const data = {
        weight_kg: 70.0,
        body_fat_pct: 15.5,
        waist_cm: 80.0,
        bmi: 22.9
      };
      const entryDate = '2026-01-15';

      const result = await saveRecord(intent, data, entryDate);

      expect(result).toBeDefined();
    });
  });

  describe('getHistory', () => {
    it('should return activity history', async () => {
      const mockRecords = [
        {
          id: 1,
          user_id: 'user_123',
          intent: 'log_strength_workout',
          data: '{"exercise_name":"Bench Press"}',
          entry_date: '2026-01-15',
          created_at: '2026-01-15T08:30:00Z'
        }
      ];

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          all: jest.fn().mockReturnValue(mockRecords)
        })
      };
      (await getDb()).prepare = mockDb.prepare;

      const result = await getHistory();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSessionMessages', () => {
    it('should return chat messages for a session', async () => {
      const sessionId = 'session_123';
      const mockMessages = [
        {
          id: 1,
          session_id: sessionId,
          role: 'user',
          content: 'Hello',
          created_at: '2026-01-15T10:00:00Z'
        },
        {
          id: 2,
          session_id: sessionId,
          role: 'assistant',
          content: 'Hi there!',
          created_at: '2026-01-15T10:01:00Z'
        }
      ];

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          all: jest.fn().mockReturnValue(mockMessages)
        })
      };
      (await getDb()).prepare = mockDb.prepare;

      const result = await getSessionMessages(sessionId);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });
  });

  describe('listChatSessions', () => {
    it('should return chat sessions', async () => {
      const mockSessions = [
        {
          id: 'session_123',
          user_id: 'user_123',
          title: 'Fitness Discussion',
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-01-15T10:30:00Z',
          message_count: 10
        }
      ];

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          all: jest.fn().mockReturnValue(mockSessions)
        })
      };
      (await getDb()).prepare = mockDb.prepare;

      const result = await listChatSessions('all');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');
    });
  });

  describe('addChatMessage', () => {
    it('should add a chat message', async () => {
      const sessionId = 'session_123';
      const role = 'user';
      const content = 'Hello, I need workout advice';

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockReturnValue({ lastInsertRowid: 1 })
        })
      };
      (await getDb()).prepare = mockDb.prepare;

      const result = await addChatMessage(sessionId, role, content);

      expect(result).toBeDefined();
    });
  });

  describe('updateActivityRecord', () => {
    it('should update an activity record', async () => {
      const recordId = 1;
      const updates = {
        data: JSON.stringify({ exercise_name: 'Updated Exercise' }),
        entry_date: '2026-01-16'
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockReturnValue({ changes: 1 })
        })
      };
      (await getDb()).prepare = mockDb.prepare;

      const result = await updateActivityRecord(recordId, updates);

      expect(result).toBe(true);
    });
  });

  describe('deleteActivityRecord', () => {
    it('should delete an activity record', async () => {
      const recordId = 1;

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockReturnValue({ changes: 1 })
        })
      };
      (await getDb()).prepare = mockDb.prepare;

      const result = await deleteActivityRecord(recordId);

      expect(result).toBe(true);
    });
  });
});
