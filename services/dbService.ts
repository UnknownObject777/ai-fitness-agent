import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.join(process.cwd(), 'fitness.sqlite');

let dbPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;

type ActivityRecord = {
  id: string;
  intent: string;
  data: any;
  entryDate?: string;
  timestamp: string;
};

type ChatSessionRow = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
  archived: number | null;
  archived_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  message_count: number | null;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archivedAt?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  messageCount: number;
};

export async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: dbPath,
      driver: sqlite3.Database
    }).then(async (db) => {
      await initSchema(db);
      return db;
    });
  }
  return dbPromise;
}

async function initSchema(db: Database<sqlite3.Database, sqlite3.Statement>) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      archived INTEGER DEFAULT 0,
      archived_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      image_data TEXT, 
      intent TEXT,
      intent_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_logs (
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

    CREATE TABLE IF NOT EXISTS meal_items (
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

    CREATE TABLE IF NOT EXISTS activity_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      intent TEXT NOT NULL,
      entry_date TEXT,
      timestamp DATETIME NOT NULL,
      data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS body_metrics (
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

    CREATE TABLE IF NOT EXISTS workout_logs (
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

    CREATE TABLE IF NOT EXISTS user_semantic_memory (
      user_id TEXT PRIMARY KEY,
      memory_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureChatSessionColumns(db);

    // Add default user if not exists
  const defaultUser = await db.get('SELECT id FROM users WHERE id = ?', 'user_1');
  if (!defaultUser) {
    await db.run('INSERT INTO users (id) VALUES (?)', 'user_1');
  }

  const defaultSession = await db.get('SELECT id FROM chat_sessions WHERE id = ?', 'session_1');
  if (!defaultSession) {
    await db.run(
      'INSERT INTO chat_sessions (id, user_id, title, archived, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      'session_1',
      'user_1',
      '默认会话',
      0
    );
  }

  await backfillLegacyRecords(db);
  await seedDemoRecords(db);
}

async function ensureChatSessionColumns(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const columns = (await db.all(`PRAGMA table_info(chat_sessions)`)) as Array<{ name: string }>;
  const names = new Set(columns.map((col) => col.name));

  if (!names.has('archived')) {
    await db.exec('ALTER TABLE chat_sessions ADD COLUMN archived INTEGER DEFAULT 0');
  }
  if (!names.has('archived_at')) {
    await db.exec('ALTER TABLE chat_sessions ADD COLUMN archived_at DATETIME');
  }
  if (!names.has('updated_at')) {
    await db.exec('ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME');
  }

  await db.exec('UPDATE chat_sessions SET archived = COALESCE(archived, 0)');
  await db.exec('UPDATE chat_sessions SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)');
}

function parseJsonSafe<T = any>(value?: string | null, fallback: T = {} as T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function resolveTimestamp(entryDate?: string) {
  if (!entryDate) return new Date().toISOString();
  if (entryDate === 'today') return new Date().toISOString();
  if (entryDate === 'yesterday') return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const parsed = Date.parse(entryDate);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

async function insertActivityRecord(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  userId: string,
  intent: string,
  data: any,
  entryDate?: string,
  id?: string,
  explicitTimestamp?: string
): Promise<ActivityRecord> {
  const recordId = id || uuidv4();
  const timestamp = explicitTimestamp || resolveTimestamp(entryDate);
  const resolvedEntryDate = entryDate || timestamp.slice(0, 10);

  await db.run(
    `INSERT OR REPLACE INTO activity_records (id, user_id, intent, entry_date, timestamp, data_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    recordId,
    userId,
    intent,
    resolvedEntryDate,
    timestamp,
    JSON.stringify(data || {})
  );

  return {
    id: recordId,
    intent,
    data: data || {},
    entryDate: resolvedEntryDate,
    timestamp
  };
}

async function backfillLegacyRecords(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const existing = await db.get<{ count: number }>('SELECT COUNT(1) as count FROM activity_records');
  if ((existing?.count || 0) > 0) return;

  const mealRows = (await db.all(`
    SELECT mi.id as id, mi.raw_json as data_json, ml.eaten_at as ts
    FROM meal_items mi
    JOIN meal_logs ml ON ml.id = mi.meal_log_id
    ORDER BY ml.eaten_at ASC
  `)) as Array<{
    id: string;
    data_json: string | null;
    ts: string;
  }>;

  for (const row of mealRows) {
    const data = parseJsonSafe(row.data_json, {});
    await insertActivityRecord(db, 'user_1', 'log_food', data, row.ts.slice(0, 10), row.id, row.ts);
  }

  const workoutRows = (await db.all(`
    SELECT id, started_at as ts, raw_json as data_json, workout_type, duration_min
    FROM workout_logs
    ORDER BY started_at ASC
  `)) as Array<{
    id: string;
    ts: string;
    data_json: string | null;
    workout_type: string | null;
    duration_min: number | null;
  }>;

  for (const row of workoutRows) {
    const fallbackData = {
      exercise_name: row.workout_type || '训练',
      duration_minutes: row.duration_min || 0
    };
    const data = parseJsonSafe(row.data_json, fallbackData);
    await insertActivityRecord(db, 'user_1', 'log_exercise', data, row.ts.slice(0, 10), row.id, row.ts);
  }

  const planRows = (await db.all(`
    SELECT id, intent, intent_data as data_json, created_at as ts
    FROM chat_messages
    WHERE intent IS NOT NULL
      AND intent NOT IN ('chat', 'ask_question', 'log_food', 'log_food_multi', 'log_exercise')
      AND intent_data IS NOT NULL
    ORDER BY created_at ASC
  `)) as Array<{
    id: string;
    intent: string;
    data_json: string | null;
    ts: string;
  }>;

  for (const row of planRows) {
    const data = parseJsonSafe(row.data_json, {});
    await insertActivityRecord(db, 'user_1', row.intent, data, row.ts.slice(0, 10), row.id, row.ts);
  }
}

async function seedDemoRecords(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const demoRows = [
    {
      id: 'demo-food-20260410',
      intent: 'log_food',
      entry_date: '2026-04-10',
      timestamp: '2026-04-10T07:30:00.000Z',
      data: {
        food_name: '鸡胸肉全麦三明治',
        quantity: 1,
        unit: '份',
        meal_type: 'breakfast',
        calories: 420,
        protein: 32,
        carbs: 38,
        fat: 12
      }
    },
    {
      id: 'demo-workout-20260410',
      intent: 'log_exercise',
      entry_date: '2026-04-10',
      timestamp: '2026-04-10T10:00:00.000Z',
      data: {
        exercise_name: '上肢力量训练',
        duration_minutes: 55,
        distance: 0,
        distance_unit: 'km'
      }
    },
    {
      id: 'demo-plan-20260410',
      intent: 'generate_workout_plan',
      entry_date: '2026-04-10',
      timestamp: '2026-04-10T12:00:00.000Z',
      data: {
        plan_metadata: {
          goal_orientation: 'fat_loss',
          total_weeks: 4,
          start_phase: 'base_building'
        },
        weekly_templates: [
          {
            week_number: 1,
            sessions: [
              { session_id: 'A', focus: '下肢力量 + 核心' },
              { session_id: 'B', focus: '上肢推拉 + 稳定性' }
            ]
          }
        ]
      }
    }
  ];

  for (const row of demoRows) {
    await db.run(
      `INSERT OR IGNORE INTO activity_records (id, user_id, intent, entry_date, timestamp, data_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row.id,
      'user_1',
      row.intent,
      row.entry_date,
      row.timestamp,
      JSON.stringify(row.data)
    );
  }
}

// Session Management
export async function getSessionMessages(sessionId: string) {
  const db = await getDb();
  const messages = await db.all('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', sessionId);
  return messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    image_data: msg.image_data,
    intent: msg.intent,
    data: msg.intent_data ? JSON.parse(msg.intent_data) : undefined,
    created_at: msg.created_at
  }));
}

export async function listChatSessions(scope: 'active' | 'archived' | 'all' = 'active'): Promise<ChatSessionSummary[]> {
  const db = await getDb();
  const whereClause = scope === 'all'
    ? ''
    : scope === 'archived'
      ? 'WHERE COALESCE(s.archived, 0) = 1'
      : 'WHERE COALESCE(s.archived, 0) = 0';

  const rows = (await db.all(
    `SELECT
      s.id,
      s.title,
      s.created_at,
      s.updated_at,
      s.archived,
      s.archived_at,
      (
        SELECT m.created_at
        FROM chat_messages m
        WHERE m.session_id = s.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_at,
      (
        SELECT m.content
        FROM chat_messages m
        WHERE m.session_id = s.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message_preview,
      (
        SELECT COUNT(1)
        FROM chat_messages m
        WHERE m.session_id = s.id
      ) AS message_count
    FROM chat_sessions s
    ${whereClause}
    ORDER BY COALESCE(last_message_at, s.updated_at, s.created_at) DESC`
  )) as ChatSessionRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title || '未命名会话',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    archived: Boolean(row.archived),
    archivedAt: row.archived_at || undefined,
    lastMessageAt: row.last_message_at || undefined,
    lastMessagePreview: row.last_message_preview || undefined,
    messageCount: row.message_count || 0
  }));
}

export async function createChatSession(title?: string, userId: string = 'user_1'): Promise<ChatSessionSummary> {
  const db = await getDb();
  const sessionId = `session_${uuidv4()}`;
  const resolvedTitle = title?.trim() || `新对话 ${new Date().toLocaleDateString('zh-CN')}`;

  await db.run(
    `INSERT INTO chat_sessions (id, user_id, title, archived, updated_at)
     VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`,
    sessionId,
    userId,
    resolvedTitle
  );

  const sessions = await listChatSessions('all');
  const created = sessions.find((session) => session.id === sessionId);
  if (!created) {
    throw new Error('Failed to create chat session');
  }
  return created;
}

export async function updateChatSession(
  sessionId: string,
  updates: { title?: string; archived?: boolean }
): Promise<ChatSessionSummary> {
  const db = await getDb();
  const current = await db.get('SELECT id FROM chat_sessions WHERE id = ?', sessionId);
  if (!current) {
    throw new Error('Session not found');
  }

  if (typeof updates.title === 'string') {
    const nextTitle = updates.title.trim();
    if (!nextTitle) {
      throw new Error('Session title cannot be empty');
    }
    await db.run(
      'UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      nextTitle,
      sessionId
    );
  }

  if (typeof updates.archived === 'boolean') {
    await db.run(
      `UPDATE chat_sessions
       SET archived = ?,
           archived_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      updates.archived ? 1 : 0,
      updates.archived ? 1 : 0,
      sessionId
    );
  }

  const sessions = await listChatSessions('all');
  const updated = sessions.find((session) => session.id === sessionId);
  if (!updated) {
    throw new Error('Failed to update session');
  }
  return updated;
}

export async function deleteChatSession(sessionId: string) {
  const db = await getDb();
  const current = await db.get('SELECT id FROM chat_sessions WHERE id = ?', sessionId);
  if (!current) {
    throw new Error('Session not found');
  }

  await db.run('DELETE FROM chat_messages WHERE session_id = ?', sessionId);
  await db.run('DELETE FROM chat_sessions WHERE id = ?', sessionId);
}

async function ensureSessionExists(sessionId: string) {
  const db = await getDb();
  const session = await db.get('SELECT id FROM chat_sessions WHERE id = ?', sessionId);
  if (!session) {
    await db.run(
      'INSERT INTO chat_sessions (id, user_id, title, archived, updated_at) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)',
      sessionId,
      'user_1',
      '未命名会话'
    );
  }
}

export async function addChatMessage(sessionId: string, role: string, content: string, image_data?: string, intent?: string, intent_data?: any) {
  const db = await getDb();
  await ensureSessionExists(sessionId);
  const msgId = uuidv4();
  await db.run(
    'INSERT INTO chat_messages (id, session_id, role, content, image_data, intent, intent_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    msgId, sessionId, role, content, image_data || null, intent || null, intent_data ? JSON.stringify(intent_data) : null
  );

  await db.run('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', sessionId);
  return { id: msgId, role, content, image_data, intent, intent_data };
}

// Backward compatible generic saveRecord
export async function saveRecord(intent: string, data: any, entryDate?: string) {
  const db = await getDb();
  const id = uuidv4();
  const timestamp = resolveTimestamp(entryDate);
  
  if (intent === 'log_food') {
    // Basic mapping, assuming total structure
    await db.run(
      'INSERT INTO meal_logs (id, user_id, meal_type, eaten_at, total_kcal, total_protein_g, total_carb_g, total_fat_g, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, 'user_1', data.meal_type || 'meal', timestamp,
      data.calories, data.protein, data.carbs, data.fat, 'manual'
    );
    await db.run(
      'INSERT INTO meal_items (id, meal_log_id, food_name, grams, kcal, protein_g, carb_g, fat_g, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uuidv4(), id, data.food_name, data.quantity, data.calories, data.protein, data.carbs, data.fat, JSON.stringify(data)
    );
  } else if (intent === 'log_exercise') {
    await db.run(
      'INSERT INTO workout_logs (id, user_id, started_at, workout_type, duration_min, note, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, 'user_1', timestamp, data.exercise_name, data.duration_minutes, '', JSON.stringify(data)
    );
  } else if (intent === 'log_strength_workout') {
    await db.run(
      'INSERT INTO workout_logs (id, user_id, started_at, workout_type, duration_min, note, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      'user_1',
      timestamp,
      data.workout_name || '力量训练',
      data.duration_minutes || 0,
      data.note || '',
      JSON.stringify(data)
    );
  } else if (intent === 'log_measurement') {
    const firstMeasurement = Array.isArray(data?.measurements) ? data.measurements[0] : undefined;
    await db.run(
      'INSERT INTO body_metrics (id, user_id, measured_at, weight_kg, body_fat_pct, waist_cm, chest_cm, hip_cm, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      'user_1',
      timestamp,
      firstMeasurement?.metric === 'weight' ? firstMeasurement.value : data.weight_kg || null,
      data.body_fat_pct || null,
      data.waist_cm || null,
      data.chest_cm || null,
      data.hip_cm || null,
      JSON.stringify(data)
    );
  }

  return insertActivityRecord(
    db,
    'user_1',
    intent,
    data,
    entryDate,
    id,
    timestamp
  );
}

// Save detailed food log from multi-modal AI output
export async function saveMealLogMulti(userId: string, responseJson: any, source: string = 'photo') {
  const db = await getDb();
  const mealLogId = uuidv4();
  const eatenAt = new Date().toISOString();

  await db.run(
    `INSERT INTO meal_logs (id, user_id, meal_type, eaten_at, total_kcal, total_protein_g, total_carb_g, total_fat_g, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    mealLogId,
    userId,
    responseJson.meal_type || 'unknown',
    eatenAt,
    responseJson.total?.kcal || 0,
    responseJson.total?.protein_g || 0,
    responseJson.total?.carb_g || 0,
    responseJson.total?.fat_g || 0,
    source
  );

  if (responseJson.items && Array.isArray(responseJson.items)) {
    for (const item of responseJson.items) {
      await db.run(
        `INSERT INTO meal_items (id, meal_log_id, food_name, food_source_id, grams, kcal, protein_g, carb_g, fat_g, confidence, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(),
        mealLogId,
        item.name,
        item.candidate_foods?.[0]?.source_id || null,
        item.estimated_grams || 0,
        item.nutrition_estimate?.kcal || 0,
        item.nutrition_estimate?.protein_g || 0,
        item.nutrition_estimate?.carb_g || 0,
        item.nutrition_estimate?.fat_g || 0,
        item.confidence || 1.0,
        JSON.stringify(item)
      );
    }
  }

  return insertActivityRecord(
    db,
    userId,
    'log_food_multi',
    responseJson,
    eatenAt.slice(0, 10),
    mealLogId,
    eatenAt
  );
}

export async function getHistory() {
  const db = await getDb();
  const rows = (await db.all(`
    SELECT id, intent, entry_date, timestamp, data_json
    FROM activity_records
    ORDER BY timestamp DESC
    LIMIT 100
  `)) as Array<{
    id: string;
    intent: string;
    entry_date: string | null;
    timestamp: string;
    data_json: string;
  }>;

  return rows.map((record) => ({
    id: record.id,
    timestamp: record.timestamp,
    intent: record.intent,
    entryDate: record.entry_date || undefined,
    data: parseJsonSafe(record.data_json, {})
  }));
}

export async function updateActivityRecord(
  recordId: string,
  updates: { data?: any; entryDate?: string }
): Promise<ActivityRecord> {
  const db = await getDb();
  const current = (await db.get(
    'SELECT id, intent, entry_date, timestamp, data_json FROM activity_records WHERE id = ?',
    recordId
  )) as {
    id: string;
    intent: string;
    entry_date: string | null;
    timestamp: string;
    data_json: string;
  } | undefined;

  if (!current) {
    throw new Error('Record not found');
  }

  const nextData = updates.data !== undefined
    ? updates.data
    : parseJsonSafe(current.data_json, {});

  let nextTimestamp = current.timestamp;
  let nextEntryDate = current.entry_date || current.timestamp.slice(0, 10);
  if (typeof updates.entryDate === 'string' && updates.entryDate.trim()) {
    nextTimestamp = resolveTimestamp(updates.entryDate.trim());
    nextEntryDate = nextTimestamp.slice(0, 10);
  }

  await db.run(
    `UPDATE activity_records
     SET data_json = ?, entry_date = ?, timestamp = ?
     WHERE id = ?`,
    JSON.stringify(nextData || {}),
    nextEntryDate,
    nextTimestamp,
    recordId
  );

  return {
    id: recordId,
    intent: current.intent,
    data: nextData || {},
    entryDate: nextEntryDate,
    timestamp: nextTimestamp
  };
}

export async function deleteActivityRecord(recordId: string) {
  const db = await getDb();
  const current = await db.get<{ id: string; intent: string }>(
    'SELECT id, intent FROM activity_records WHERE id = ?',
    recordId
  );
  if (!current) {
    throw new Error('Record not found');
  }

  await db.run('DELETE FROM activity_records WHERE id = ?', recordId);

  if (current.intent === 'log_food' || current.intent === 'log_food_multi') {
    await db.run('DELETE FROM meal_items WHERE meal_log_id = ?', recordId);
    await db.run('DELETE FROM meal_logs WHERE id = ?', recordId);
  }
  if (current.intent === 'log_exercise' || current.intent === 'log_strength_workout') {
    await db.run('DELETE FROM workout_logs WHERE id = ?', recordId);
  }
  if (current.intent === 'log_measurement') {
    await db.run('DELETE FROM body_metrics WHERE id = ?', recordId);
  }
}

export async function getSemanticMemory(userId: string = 'user_1') {
  const db = await getDb();
  const row = await db.get('SELECT memory_json FROM user_semantic_memory WHERE user_id = ?', userId);
  return row ? JSON.parse(row.memory_json) : null;
}

export async function saveSemanticMemory(userId: string, memory: any) {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO user_semantic_memory (user_id, memory_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    userId,
    JSON.stringify(memory)
  );
}

export async function getEpisodicMemories(userId: string = 'user_1', limit: number = 20) {
  const db = await getDb();
  const rows = await db.all(
    'SELECT * FROM activity_records WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
    userId,
    limit
  );
  return rows.map(r => ({
    id: r.id,
    intent: r.intent,
    entryDate: r.entry_date,
    timestamp: r.timestamp,
    data: JSON.parse(r.data_json)
  }));
}
