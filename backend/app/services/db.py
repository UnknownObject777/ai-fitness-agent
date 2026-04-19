import aiosqlite

from app.config import get_settings


async def get_connection() -> aiosqlite.Connection:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(settings.database_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db() -> None:
    async with await get_connection() as db:
        await db.executescript(
            """
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
            """
        )
        await ensure_chat_session_columns(db)
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", ("user_1",))
        await db.execute(
            """
            INSERT OR IGNORE INTO chat_sessions (id, user_id, title, archived, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            ("session_1", "user_1", "Default session", 0),
        )
        await db.commit()


async def ensure_chat_session_columns(db: aiosqlite.Connection) -> None:
    cursor = await db.execute("PRAGMA table_info(chat_sessions)")
    columns = await cursor.fetchall()
    names = {row["name"] for row in columns}

    if "archived" not in names:
        await db.execute("ALTER TABLE chat_sessions ADD COLUMN archived INTEGER DEFAULT 0")
    if "archived_at" not in names:
        await db.execute("ALTER TABLE chat_sessions ADD COLUMN archived_at DATETIME")
    if "updated_at" not in names:
        await db.execute("ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME")

    await db.execute("UPDATE chat_sessions SET archived = COALESCE(archived, 0)")
    await db.execute(
        "UPDATE chat_sessions SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
    )

