# Backend Unit Tests for Sparky AI Fitness Agent

This directory contains comprehensive unit and integration tests for the Sparky AI Fitness Agent backend.

## Test Structure

```
tests/
├── README.md                 # This file
├── setup.ts                  # Test setup and configuration
├── conftest.py              # Python test fixtures (if needed)
├── fixtures/                # Test data fixtures
│   ├── index.ts
│   ├── workoutData.ts
│   └── nutritionData.ts
├── unit/                    # Unit tests
│   └── services/
│       ├── dbService.test.ts
│       ├── trainingAnalytics.test.ts
│       ├── nutritionService.test.ts
│       ├── insightEngine.test.ts
│       ├── memoryService.test.ts
│       └── systemPrompt.test.ts
└── integration/             # Integration tests
    └── api.test.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run with coverage report
```bash
npm run test:coverage
```

### Run only unit tests
```bash
npm run test:unit
```

### Run only integration tests
```bash
npm run test:integration
```

## Test Coverage

The test suite aims for comprehensive coverage of:

### Services (services/)
- **dbService.ts** - Database operations, CRUD, schema
- **trainingAnalytics.ts** - Workout trend analysis, volume calculation
- **nutritionService.ts** - Nutrition analysis, macro calculation
- **insightEngine.ts** - Insight generation, recommendations
- **memoryService.ts** - AI memory, context building
- **systemPrompt.ts** - Intent definitions, prompt generation

### API Endpoints (server.ts)
- GET /api/system-prompt
- GET /api/chat/:sessionId
- GET /api/chat-sessions
- POST /api/chat-sessions
- POST /api/chat-openai
- POST /api/save-record
- GET /api/logs
- GET /api/analysis/workout-trends
- GET /api/analysis/nutrition
- GET /api/analysis/summary

## Writing Tests

### Example Unit Test

```typescript
import { getWorkoutTrends } from '../../../services/trainingAnalytics';

jest.mock('../../../services/dbService');

describe('trainingAnalytics', () => {
  it('should calculate volume correctly', async () => {
    // Arrange
    const mockWorkoutLogs = [
      { exercise_name: 'Bench Press', sets: 4, reps: 10, weight_kg: 80 }
    ];
    
    // Act
    const result = await getWorkoutTrends('user_123', '7d');
    
    // Assert
    expect(result.summary.totalVolume).toBe(3200); // 4 × 10 × 80
  });
});
```

### Example Integration Test

```typescript
import request from 'supertest';
import express from 'express';

describe('API Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // ... setup routes
  });

  it('should save workout record', async () => {
    const response = await request(app)
      .post('/api/save-record')
      .send({
        intent: 'log_strength_workout',
        data: { exercise_name: 'Bench Press', sets: 4, reps: 10 }
      })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

## Test Fixtures

Test fixtures are located in `tests/fixtures/` and provide consistent test data:

- **workoutData.ts** - Sample workouts, exercises, trends
- **nutritionData.ts** - Sample meals, nutrition data
- **index.ts** - Combined exports

## Mocking

The test suite uses Jest's mocking capabilities:

```typescript
// Mock a service
jest.mock('../../../services/dbService');

// Mock a module
jest.mock('better-sqlite3');

// Mock with implementation
jest.mock('../../../services/openai', () => ({
  getChatCompletion: jest.fn().mockResolvedValue({
    intent: 'log_strength_workout',
    data: { exercise_name: 'Bench Press' }
  })
}));
```

## Continuous Integration

Tests are designed to run in CI environments:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Contributing

When adding new tests:

1. Follow the existing directory structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Mock external dependencies
5. Clean up after tests (use `beforeEach`/`afterEach`)

## Troubleshooting

### Common Issues

1. **Database locked errors**: Ensure tests use unique database instances
2. **Async timeout**: Increase `testTimeout` in jest.config.js
3. **Module not found**: Check TypeScript path mappings

### Debug Mode

Run tests with debug output:

```bash
DEBUG=true npm test
```

## License

These tests are part of the Sparky AI Fitness Agent project.
