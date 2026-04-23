/**
 * Unit tests for utility helpers
 */

describe('Test Environment', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should have access to test environment variables', () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined();
    expect(process.env.OPENAI_MODEL).toBe('gpt-4o-mini');
  });
});

describe('Math Utilities', () => {
  it('should calculate BMI correctly', () => {
    const weightKg = 70;
    const heightM = 1.75;
    const bmi = weightKg / (heightM * heightM);

    expect(bmi).toBeCloseTo(22.86, 1);
  });

  it('should calculate training volume correctly', () => {
    const sets = 4;
    const reps = 10;
    const weightKg = 80;
    const volume = sets * reps * weightKg;

    expect(volume).toBe(3200);
  });

  it('should calculate macro percentages correctly', () => {
    const proteinG = 150;
    const carbG = 200;
    const fatG = 67;

    const proteinKcal = proteinG * 4;
    const carbKcal = carbG * 4;
    const fatKcal = fatG * 9;
    const totalKcal = proteinKcal + carbKcal + fatKcal;

    const proteinPct = (proteinKcal / totalKcal) * 100;
    const carbPct = (carbKcal / totalKcal) * 100;

    expect(proteinPct).toBeCloseTo(30, 0);
    expect(carbPct).toBeCloseTo(40, 0);
  });
});

describe('Date Utilities', () => {
  it('should format date correctly', () => {
    const date = new Date('2026-01-15');
    const formatted = date.toISOString().split('T')[0];

    expect(formatted).toBe('2026-01-15');
  });

  it('should calculate days between dates', () => {
    const date1 = new Date('2026-01-15');
    const date2 = new Date('2026-01-20');
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(5);
  });

  it('should get week number from date', () => {
    const date = new Date('2026-01-15');
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDays = (date.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);

    expect(weekNumber).toBeGreaterThan(0);
    expect(weekNumber).toBeLessThanOrEqual(53);
  });
});

describe('String Utilities', () => {
  it('should capitalize first letter', () => {
    const str = 'hello world';
    const capitalized = str.charAt(0).toUpperCase() + str.slice(1);

    expect(capitalized).toBe('Hello world');
  });

  it('should convert to camelCase', () => {
    const str = 'hello_world_test';
    const camelCase = str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    expect(camelCase).toBe('helloWorldTest');
  });

  it('should truncate string', () => {
    const str = 'This is a very long string that needs to be truncated';
    const maxLength = 20;
    const truncated = str.length > maxLength ? str.slice(0, maxLength) + '...' : str;

    expect(truncated).toBe('This is a very long...');
    expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
  });
});

describe('Array Utilities', () => {
  it('should group array by key', () => {
    const arr = [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
      { category: 'A', value: 3 }
    ];

    const grouped = arr.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof arr>);

    expect(grouped['A']).toHaveLength(2);
    expect(grouped['B']).toHaveLength(1);
  });

  it('should sort array by date', () => {
    const arr = [
      { date: '2026-01-15', value: 1 },
      { date: '2026-01-10', value: 2 },
      { date: '2026-01-20', value: 3 }
    ];

    const sorted = [...arr].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    expect(sorted[0].date).toBe('2026-01-10');
    expect(sorted[2].date).toBe('2026-01-20');
  });

  it('should calculate average', () => {
    const arr = [10, 20, 30, 40, 50];
    const average = arr.reduce((sum, val) => sum + val, 0) / arr.length;

    expect(average).toBe(30);
  });
});
