---
name: database_schema
description: SQLite database schema for Sparky AI Fitness Agent
type: reference
---

# Database Schema

Database file: `fitness.sqlite` (file-based SQLite)

## Tables

### users
User accounts (default: user_1)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### chat_sessions
Chat session management with archive support
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived INTEGER DEFAULT 0,
  archived_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### chat_messages
Individual chat messages with intent tracking
```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT,
  intent TEXT,
  intent_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### meal_logs
Aggregated meal records
```sql
CREATE TABLE meal_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  meal_type TEXT,
  eaten_at DATETIME NOT NULL,
  total_kcal REAL,
  total_protein_g REAL,
  total_carb_g REAL,
  total_fat_g REAL,
  source TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### meal_items
Individual food items within a meal
```sql
CREATE TABLE meal_items (
  id TEXT PRIMARY KEY,
  meal_log_id TEXT NOT NULL,
  food_name TEXT NOT NULL,
  food_source_id TEXT,
  grams REAL,
  kcal REAL,
  protein_g REAL,
  carb_g REAL,
  fat_g REAL,
  confidence REAL,
  raw_json TEXT,
  FOREIGN KEY(meal_log_id) REFERENCES meal_logs(id)
);
```

### activity_records
**Unified activity log** - Primary storage for all user activities
```sql
CREATE TABLE activity_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  entry_date TEXT,
  timestamp DATETIME NOT NULL,
  data_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
Stores: food logs, workouts, plans, measurements (any intent type)

### body_metrics
Body measurement records
```sql
CREATE TABLE body_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  measured_at DATETIME NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  waist_cm REAL,
  chest_cm REAL,
  hip_cm REAL,
  raw_json TEXT
);
```

### workout_logs
Detailed workout records
```sql
CREATE TABLE workout_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  workout_type TEXT,
  duration_min INTEGER,
  calories_burned REAL,
  rpe REAL,
  note TEXT,
  raw_json TEXT
);
```

### user_semantic_memory
AI memory for user profile and preferences
```sql
CREATE TABLE user_semantic_memory (
  user_id TEXT PRIMARY KEY,
  memory_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Key Relationships

```
users (1) ───< chat_sessions (N)
users (1) ───< chat_messages (N) via session
users (1) ───< meal_logs (N)
meal_logs (1) ───< meal_items (N)
users (1) ───< activity_records (N)
users (1) ───< body_metrics (N)
users (1) ───< workout_logs (N)
users (1) ──1 user_semantic_memory (1)
```

## Data Flow

1. **Chat Input** → AI processes → Intent extracted → `activity_records` + specific tables
2. **Food Image** → AI vision → `meal_logs`/`meal_items` + `activity_records`
3. **Workout Log** → `workout_logs` + `activity_records`
4. **Analysis APIs** → Query `activity_records` + specific tables → Insights

## Important Notes

- `activity_records` is the **unified source of truth** for all user activities
- Specific tables (meal_logs, workout_logs, etc.) hold normalized data for queries
- JSON fields store AI-extracted flexible data
- All timestamps stored in ISO 8601 format
