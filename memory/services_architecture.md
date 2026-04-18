---
name: services_architecture
description: Backend services organization and responsibilities
type: reference
---

# Services Architecture

All services are located in `services/` directory.

## Service Overview

| Service | File | Purpose |
|---------|------|---------|
| Database Service | `dbService.ts` | SQLite operations, schema, CRUD |
| System Prompt | `systemPrompt.ts` | AI system prompt definition |
| Memory Service | `memoryService.ts` | AI memory (semantic/episodic) |
| Training Analytics | `trainingAnalytics.ts` | Workout trend analysis |
| Nutrition Service | `nutritionService.ts` | Nutrition data analysis |
| Insight Engine | `insightEngine.ts` | Generate insights from data |

---

## dbService.ts

**Responsibilities:**
- Database connection management (SQLite)
- Schema initialization
- CRUD operations for all entities
- Session management
- Activity record operations

**Key Exports:**
```typescript
getDb(): Promise<Database>                    // Get database instance
saveRecord(intent, data, entryDate)            // Save activity record
getHistory(): Promise<ActivityRecord[]>       // Get recent activities
getSessionMessages(sessionId)                 // Get chat messages
listChatSessions(scope)                       // List sessions
addChatMessage(...)                           // Add chat message
updateActivityRecord(recordId, updates)       // Update record
deleteActivityRecord(recordId)                // Delete record
```

**Database Tables Managed:**
- `users`, `chat_sessions`, `chat_messages`
- `meal_logs`, `meal_items`
- `activity_records` (unified activity log)
- `body_metrics`, `workout_logs`
- `user_semantic_memory`

---

## systemPrompt.ts

**Responsibilities:**
- Define AI behavior and personality
- Specify output formats (JSON schemas)
- Document intent types and data structures
- Guide multi-modal (image) processing

**Key Export:**
```typescript
getSystemPrompt(): string  // Returns complete system prompt in Chinese
```

**Intent Types Defined:**
1. `generate_workout_plan` - Create training plan
2. `update_workout_plan` - Adjust existing plan
3. `log_strength_workout` - Log weight training
4. `log_exercise` - Log cardio/general exercise
5. `log_food` - Log diet (text)
6. `log_food_multi` - Log diet (image recognition)
7. `log_measurement` - Log body metrics
8. `chat` - General chat

---

## memoryService.ts

**Responsibilities:**
- Manage AI memory (semantic + episodic)
- Build agent context from memories
- Format context as system prompt extensions
- Track user profile, training stats, weekly progress

**Key Types:**
```typescript
interface SemanticMemory {
  userId: string;
  userProfile: UserProfile;
  strengthModel: Record<string, any>;
  weeklyTrainingStats?: Record<string, WeeklyTrainingStats>;
  updatedAt: string;
}

interface UserProfile {
  goals: string[];
  weakPoints: string[];
  preferredStyle: string;
  injuryHistory: string[];
}

interface WeeklyTrainingStats {
  weekId: string;
  startDate: string;
  endDate: string;
  totalWorkouts: number;
  muscleGroupVolume: Record<string, {...}>;
  exerciseRecords: Record<string, {...}>;
}
```

**Key Exports:**
```typescript
getOrInitSemanticMemory(userId): Promise<SemanticMemory>
updateSemanticMemory(updates, userId): Promise<SemanticMemory>
buildAgentContext(userMessage, sessionId, recentMessages): Promise<AgentContext>
formatContextAsSystemPrompt(ctx): string
analyzeMuscleGroups(workoutData): MuscleAnalysis
aggregateWeeklyStats(userId, weekId, records): WeeklyTrainingStats
getWeekNumber(date): number
mergeWeeklyStats(existing, newStats): void
```

---

## trainingAnalytics.ts

**Responsibilities:**
- Analyze workout trends over time
- Calculate volume, frequency, strength progress
- Map exercises to muscle groups
- Generate analytics data for charts

**Key Types:**
```typescript
interface WorkoutTrendPoint {
  date: string;
  totalVolume: number;       // kg (sets × reps × weight)
  workoutCount: number;
  durationMin: number;
  avgRpe: number | null;
  muscleGroups: string[];
}

interface MuscleGroupDistribution {
  group: string;
  volume: number;
  sessions: number;
}

interface StrengthProgressPoint {
  date: string;
  exercise: string;
  estimated1RM: number;
  bestSet: { weight: number; reps: number };
}

interface WorkoutTrendsResult {
  trendPoints: WorkoutTrendPoint[];
  muscleDistribution: MuscleGroupDistribution[];
  strengthProgress: StrengthProgressPoint[];
  summary: {
    totalWorkouts: number;
    totalVolume: number;
    avgWorkoutsPerWeek: number;
    mostTrainedGroup: string;
    totalDurationMin: number;
  };
}

interface BodyMetricPoint {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  bmi: number | null;
}
```

**Key Exports:**
```typescript
getWorkoutTrends(userId, range): Promise<WorkoutTrendsResult>  // range: '7d'|'30d'|'90d'|'180d'
getBodyMetricsTrend(userId, range): Promise<BodyMetricPoint[]>
```

**Exercise to Muscle Group Mapping:**
The service includes `EXERCISE_MUSCLE_MAP` that maps exercise names (Chinese + English) to muscle groups:
- Chest: 卧推, bench press, 俯卧撑, etc.
- Back: 引体向上, 划船, deadlift, etc.
- Legs: 深蹲, squat, lunge, etc.
- Shoulders: 肩推, shoulder press, etc.
- Arms: 弯举, curl, tricep, etc.
- Core: 卷腹, plank, crunch, etc.

---

## nutritionService.ts

**Responsibilities:**
- Analyze nutrition trends over time
- Aggregate daily calorie/macro data
- Calculate macro distribution percentages
- Compare against goals

**Key Types:**
```typescript
interface DailyNutrition {
  date: string;
  totalKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  mealCount: number;
}

interface MacroDistribution {
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  avgProteinG: number;
  avgCarbG: number;
  avgFatG: number;
}

interface NutritionAnalysisResult {
  dailyData: DailyNutrition[];
  macroDistribution: MacroDistribution;
  summary: {
    avgDailyKcal: number;
    avgProteinG: number;
    daysLogged: number;
    proteinGoalPct: number;
    calorieConsistencyScore: number;
    streakDays: number;
  };
  goalComparison: {
    targetKcal: number;
    avgKcal: number;
    deficitOrSurplus: number;
    targetProteinG: number;
    avgProteinG: number;
    proteinAdequacy: 'adequate' | 'low' | 'high';
  };
}
```

**Key Export:**
```typescript
getNutritionAnalysis(userId, range): Promise<NutritionAnalysisResult>
```

**Data Sources:**
1. `meal_logs` table - Primary source for aggregated meal data
2. `activity_records` with `intent='log_food'` - Supplementary data

**Calculations:**
- Macro % by calories: protein=4kcal/g, carb=4kcal/g, fat=9kcal/g
- Consistency score: 1 - (stddev / mean), clamped 0-100
- Streak: consecutive days with food logs from today going back
- Goals: 2000kcal target, 1.8g/kg protein (70kg assumed weight)

---

## insightEngine.ts

**Responsibilities:**
- Generate actionable insights from analytics data
- Identify patterns, warnings, and successes
- Provide personalized recommendations
- Combine workout + nutrition insights

**Key Type:**
```typescript
interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  category: 'workout' | 'nutrition' | 'body' | 'general';
  title: string;
  message: string;
  priority: number; // 1 = highest
}
```

**Key Exports:**
```typescript
generateWorkoutInsights(data: WorkoutTrendsResult): Insight[]
generateNutritionInsights(data: NutritionAnalysisResult): Insight[]
generateCombinedInsights(workoutData, nutritionData): Insight[]
```

**Workout Insights Generated:**
- Training frequency (too low, good, excellent)
- Volume trend (increasing/decreasing)
- Muscle imbalance (chest/back ratio, leg volume)
- Strength progress (1RM improvements)
- Duration analysis (too short/long)

**Nutrition Insights Generated:**
- Calorie adequacy (on target, surplus, deficit)
- Protein intake (adequate, low, high)
- Macro balance (carb/fat ratios)
- Consistency score
- Streak tracking

**Priority System:**
- 1 = Highest (warnings, critical issues)
- 2 = High (improvements, trends)
- 3 = Medium (tips, suggestions)
- 4 = Low (encouragement, streaks)
