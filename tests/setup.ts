/**
 * Test setup file for Jest
 * Configure test environment and global mocks
 */

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
process.env.OPENAI_MODEL = 'gpt-4o-mini';

// Global test timeout
jest.setTimeout(10000);

// Silence console errors in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
  };
}
