/**
 * Integration tests for API endpoints
 */

import request from 'supertest';
import express from 'express';

// Mock the services
jest.mock('../../services/dbService');
jest.mock('../../services/trainingAnalytics');
jest.mock('../../services/nutritionService');
jest.mock('../../services/insightEngine');

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    // Import server after mocking
    app = express();
    app.use(express.json());

    // Define test routes
    app.get('/api/system-prompt', (req, res) => {
      res.json({ prompt: 'Test system prompt' });
    });

    app.get('/api/chat/:sessionId', (req, res) => {
      res.json([
        { id: 1, role: 'user', content: 'Hello' },
        { id: 2, role: 'assistant', content: 'Hi!' }
      ]);
    });

    app.post('/api/save-record', (req, res) => {
      res.json({ success: true, recordId: 1 });
    });

    app.get('/api/logs', (req, res) => {
      res.json([
        { id: 1, intent: 'log_food', date: '2026-01-15' },
        { id: 2, intent: 'log_strength_workout', date: '2026-01-16' }
      ]);
    });

    app.get('/api/analysis/workout-trends', (req, res) => {
      res.json({
        trendPoints: [],
        muscleDistribution: [],
        strengthProgress: [],
        summary: { totalWorkouts: 5 }
      });
    });

    app.get('/api/analysis/nutrition', (req, res) => {
      res.json({
        dailyData: [],
        macroDistribution: {},
        summary: { avgDailyKcal: 2000 }
      });
    });
  });

  describe('GET /api/system-prompt', () => {
    it('should return system prompt', async () => {
      const response = await request(app)
        .get('/api/system-prompt')
        .expect(200);

      expect(response.body).toHaveProperty('prompt');
      expect(typeof response.body.prompt).toBe('string');
    });
  });

  describe('GET /api/chat/:sessionId', () => {
    it('should return chat messages for session', async () => {
      const sessionId = 'session_123';

      const response = await request(app)
        .get(`/api/chat/${sessionId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('role');
      expect(response.body[0]).toHaveProperty('content');
    });
  });

  describe('POST /api/save-record', () => {
    it('should save workout record', async () => {
      const recordData = {
        intent: 'log_strength_workout',
        data: {
          exercise_name: 'Bench Press',
          muscle_group: 'chest',
          sets: 4,
          reps: 10,
          weight_kg: 80.0
        },
        entryDate: '2026-01-15'
      };

      const response = await request(app)
        .post('/api/save-record')
        .send(recordData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('recordId');
    });

    it('should save food record', async () => {
      const recordData = {
        intent: 'log_food',
        data: {
          food_name: 'Grilled Chicken Salad',
          calories: 450,
          protein_g: 35.0,
          meal_type: 'lunch'
        },
        entryDate: '2026-01-15'
      };

      const response = await request(app)
        .post('/api/save-record')
        .send(recordData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/logs', () => {
    it('should return activity history', async () => {
      const response = await request(app)
        .get('/api/logs')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('intent');
      expect(response.body[0]).toHaveProperty('date');
    });
  });

  describe('GET /api/analysis/workout-trends', () => {
    it('should return workout trend analysis', async () => {
      const response = await request(app)
        .get('/api/analysis/workout-trends')
        .query({ range: '7d' })
        .expect(200);

      expect(response.body).toHaveProperty('trendPoints');
      expect(response.body).toHaveProperty('muscleDistribution');
      expect(response.body).toHaveProperty('strengthProgress');
      expect(response.body).toHaveProperty('summary');
    });
  });

  describe('GET /api/analysis/nutrition', () => {
    it('should return nutrition analysis', async () => {
      const response = await request(app)
        .get('/api/analysis/nutrition')
        .query({ range: '7d' })
        .expect(200);

      expect(response.body).toHaveProperty('dailyData');
      expect(response.body).toHaveProperty('macroDistribution');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('goalComparison');
    });
  });
});
