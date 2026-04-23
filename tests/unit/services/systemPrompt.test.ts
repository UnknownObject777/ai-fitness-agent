/**
 * Unit tests for systemPrompt service
 */

import {
  getSystemPrompt,
  getIntentDefinitions,
  validateIntentData,
  IntentType
} from '../../../services/systemPrompt';

describe('systemPrompt', () => {
  describe('getSystemPrompt', () => {
    it('should return system prompt string', () => {
      const prompt = getSystemPrompt();

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should contain Chinese instructions', () => {
      const prompt = getSystemPrompt();

      expect(prompt).toContain('健身');
      expect(prompt).toContain('营养');
    });

    it('should contain intent definitions', () => {
      const prompt = getSystemPrompt();

      expect(prompt).toContain('log_strength_workout');
      expect(prompt).toContain('log_food');
      expect(prompt).toContain('generate_workout_plan');
    });

    it('should contain JSON format instructions', () => {
      const prompt = getSystemPrompt();

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('intent');
      expect(prompt).toContain('data');
    });
  });

  describe('getIntentDefinitions', () => {
    it('should return all intent definitions', () => {
      const intents = getIntentDefinitions();

      expect(Array.isArray(intents)).toBe(true);
      expect(intents.length).toBeGreaterThan(0);
    });

    it('should have properly structured intent definitions', () => {
      const intents = getIntentDefinitions();

      intents.forEach(intent => {
        expect(intent).toHaveProperty('type');
        expect(intent).toHaveProperty('description');
        expect(intent).toHaveProperty('dataSchema');
      });
    });

    it('should include all required intent types', () => {
      const intents = getIntentDefinitions();
      const intentTypes = intents.map(i => i.type);

      expect(intentTypes).toContain('log_strength_workout');
      expect(intentTypes).toContain('log_exercise');
      expect(intentTypes).toContain('log_food');
      expect(intentTypes).toContain('log_food_multi');
      expect(intentTypes).toContain('log_measurement');
      expect(intentTypes).toContain('generate_workout_plan');
      expect(intentTypes).toContain('update_workout_plan');
      expect(intentTypes).toContain('chat');
    });
  });

  describe('validateIntentData', () => {
    it('should validate log_strength_workout data', () => {
      const data = {
        exercise_name: 'Bench Press',
        muscle_group: 'chest',
        sets: 4,
        reps: 10,
        weight_kg: 80.0,
        rpe: 8
      };

      const result = validateIntentData('log_strength_workout', data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing required fields', () => {
      const data = {
        exercise_name: 'Bench Press'
        // Missing required fields
      };

      const result = validateIntentData('log_strength_workout', data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate log_food data', () => {
      const data = {
        food_name: 'Grilled Chicken Salad',
        calories: 450,
        protein_g: 35.0,
        carbs_g: 25.0,
        fat_g: 20.0,
        meal_type: 'lunch'
      };

      const result = validateIntentData('log_food', data);

      expect(result.valid).toBe(true);
    });

    it('should validate log_measurement data', () => {
      const data = {
        weight_kg: 70.0,
        body_fat_pct: 15.5,
        waist_cm: 80.0,
        bmi: 22.9
      };

      const result = validateIntentData('log_measurement', data);

      expect(result.valid).toBe(true);
    });

    it('should validate chat intent with no data', () => {
      const result = validateIntentData('chat', {});

      expect(result.valid).toBe(true);
    });

    it('should return error for invalid intent type', () => {
      const result = validateIntentData('invalid_intent' as IntentType, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown intent type');
    });
  });
});
