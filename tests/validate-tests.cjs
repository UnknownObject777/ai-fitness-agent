#!/usr/bin/env node

/**
 * Test validation script
 * Verifies that all test files are properly configured
 */

const fs = require('fs');
const path = require('path');

const TEST_DIR = path.join(__dirname);
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.blue);
  log('║       Sparky AI Fitness Agent - Test Validation            ║', colors.blue);
  log('╚════════════════════════════════════════════════════════════╝\n', colors.blue);

  let allPassed = true;

  // Check required files
  const requiredFiles = [
    'setup.ts',
    'README.md',
    'TEST_SUMMARY.md',
    'jest.config.js',
    'fixtures/index.ts',
    'fixtures/workoutData.ts',
    'fixtures/nutritionData.ts',
    'unit/services/trainingAnalytics.test.ts',
    'unit/services/nutritionService.test.ts',
    'unit/services/insightEngine.test.ts',
    'unit/services/dbService.test.ts',
    'unit/services/memoryService.test.ts',
    'unit/services/systemPrompt.test.ts',
    'unit/utils/helpers.test.ts',
    'integration/api.test.ts',
  ];

  log('📁 Checking required test files...\n', colors.yellow);

  requiredFiles.forEach(file => {
    const filePath = path.join(TEST_DIR, file);
    const exists = checkFileExists(filePath);
    const status = exists ? '✅' : '❌';
    const color = exists ? colors.green : colors.red;

    log(`  ${status} ${file}`, color);

    if (!exists) allPassed = false;
  });

  // Check Jest configuration
  log('\n⚙️  Checking Jest configuration...', colors.yellow);

  const jestConfigPath = path.join(__dirname, '..', 'jest.config.js');
  if (checkFileExists(jestConfigPath)) {
    log('  ✅ jest.config.js exists', colors.green);

    const config = require(jestConfigPath);
    const requiredProps = ['preset', 'testEnvironment', 'roots', 'testMatch'];

    requiredProps.forEach(prop => {
      if (config[prop]) {
        log(`  ✅ ${prop} is configured`, colors.green);
      } else {
        log(`  ❌ ${prop} is missing`, colors.red);
        allPassed = false;
      }
    });
  } else {
    log('  ❌ jest.config.js not found', colors.red);
    allPassed = false;
  }

  // Check package.json scripts
  log('\n📦 Checking package.json scripts...', colors.yellow);

  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (checkFileExists(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const testScripts = ['test', 'test:watch', 'test:coverage', 'test:unit', 'test:integration'];

    testScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        log(`  ✅ npm run ${script}`, colors.green);
      } else {
        log(`  ❌ npm run ${script} (missing)`, colors.red);
        allPassed = false;
      }
    });
  }

  // Summary
  log('\n╔════════════════════════════════════════════════════════════╗', colors.blue);
  if (allPassed) {
    log('║  ✅ ALL CHECKS PASSED - Tests are ready to run!            ║', colors.green);
  } else {
    log('║  ❌ SOME CHECKS FAILED - Please review the issues above   ║', colors.red);
  }
  log('╚════════════════════════════════════════════════════════════╝\n', colors.blue);

  if (allPassed) {
    log('Next steps:', colors.yellow);
    log('  1. Run tests:        npm test', colors.blue);
    log('  2. Watch mode:       npm run test:watch', colors.blue);
    log('  3. With coverage:    npm run test:coverage', colors.blue);
    log('');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run validation
validateTests();
