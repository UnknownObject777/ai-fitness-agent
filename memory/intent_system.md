---
name: intent_system
description: AI intent extraction system for Sparky AI Fitness Agent
type: reference
---

# Intent System

The AI returns structured JSON with intents that the frontend displays and saves.

## Intent Types

### 1. generate_workout_plan
Create a training plan based on user goals/experience/schedule.

**When to use:**
- User asks for a new training plan
- "给我做个计划" / "帮我安排一周训练"

**Data Structure:**
```typescript
{
  plan_metadata: {
    goal_orientation: "fat_loss" | "muscle_gain" | "performance" | "general_fitness",
    total_weeks: number,
    start_phase: "基础适应" | "容量构建" | "强化阶段",
    rationale: string
  },
  weekly_templates: [{
    week_number: number,
    sessions: [{
      session_id: string,
      focus: string,
      exercises: [{
        name: string,
        sets: number,
        reps: number,
        rpe: number,
        notes: string
      }]
    }]
  }]
}
```

---

### 2. update_workout_plan
Adjust existing plan based on recent performance.

**When to use:**
- User wants to modify current plan
- "根据我最近的情况调整计划"

**Data Structure:**
```typescript
{
  reason: string,
  changes: [{
    field: string,
    from: any,
    to: any
  }],
  next_week_focus: string
}
```

---

### 3. log_strength_workout
Log a weight/strength training session.

**When to use:**
- User reports completing a workout
- "今天练了胸" / "刚做完深蹲"

**Data Structure:**
```typescript
{
  workout_name: string,
  duration_minutes: number,
  exercises: [{
    name: string,
    muscle_groups: {
      primary: string[],
      secondary: string[]
    },
    sets: [{
      weight: number,
      reps: number,
      rpe: number,
      failure: boolean
    }]
  }],
  training_volume: {
    total_sets: number,
    total_reps: number,
    total_volume_load: number,
    muscle_group_distribution: Record<string, { sets: number, volume_load: number }>
  }
}
```

---

### 4. log_exercise
Log cardio or general exercise.

**When to use:**
- User reports cardio, running, swimming, etc.
- "跑了5公里" / "游泳30分钟"

**Data Structure:**
```typescript
{
  exercise_name: string,
  duration_minutes: number,
  distance: number,
  distance_unit: "km" | "mi" | "m"
}
```

---

### 5. log_food
Log diet via text.

**When to use:**
- User describes what they ate
- "吃了鸡胸肉和米饭" / "早餐是燕麦"

**Data Structure:**
```typescript
{
  food_name: string,
  quantity: number,
  unit: string,
  meal_type: "breakfast" | "lunch" | "dinner" | "snack",
  calories: number,
  protein: number,
  carbs: number,
  fat: number
}
```

---

### 6. log_food_multi
Log diet via image recognition.

**When to use:**
- User uploads food photo
- AI vision identifies food items

**Data Structure:**
```typescript
{
  intent: "log_food_multi",
  response: string,
  meal_type: "breakfast" | "lunch" | "dinner" | "snack",
  items: [{
    name: string,
    estimated_grams: number,
    confidence: number,
    nutrition_estimate: {
      kcal: number,
      protein_g: number,
      carb_g: number,
      fat_g: number
    },
    candidate_foods: [{ source_id: string, name: string }]
  }],
  total: { kcal: number, protein_g: number, carb_g: number, fat_g: number },
  needs_user_confirmation: boolean
}
```

---

### 7. log_measurement
Log body metrics.

**When to use:**
- User reports weight, body fat, measurements
- "体重70kg" / "体脂15%"

**Data Structure:**
```typescript
{
  weight_kg: number,
  body_fat_pct: number,
  waist_cm: number,
  measurements: [{
    metric: "weight" | "body_fat" | "waist" | "chest" | "hip",
    value: number,
    unit: string
  }]
}
```

---

### 8. chat
General chat without action.

**When to use:**
- Casual conversation, questions, advice

**Data Structure:**
```typescript
{
  response: string,
  intent: "chat",
  data: null
}
```

## Intent Selection Rules

From `systemPrompt.ts`:

1. **"给我做计划/安排周期/一周怎么练"** → `generate_workout_plan`
2. **"按我最近执行情况改计划/调整计划"** → `update_workout_plan`
3. **"我今天做了什么训练"** → `log_strength_workout` or `log_exercise`
4. **"我吃了什么" (text)** → `log_food`
5. **Image uploaded** → `log_food_multi`

## Response Format

All intents return JSON with:
```typescript
{
  response: string,        // Human-readable response
  intent: string,          // Intent type
  data?: object,           // Structured data (per intent)
  entryDate?: string,      // Optional date override
  profile_update?: object  // User profile updates
}
```
