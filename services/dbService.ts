import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'local_records.json');

// Initialize database file
async function initDb() {
  try {
    await fs.access(DB_PATH);
  } catch (error) {
    await fs.writeFile(DB_PATH, JSON.stringify([], null, 2));
  }
}

// Save record
export async function saveRecord(intent: string, data: any, entryDate?: string) {
  await initDb();
  const fileContent = await fs.readFile(DB_PATH, 'utf8');
  const records = JSON.parse(fileContent);
  
  const newRecord = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    intent,
    entryDate: entryDate || 'today',
    data
  };
  
  records.push(newRecord);
  await fs.writeFile(DB_PATH, JSON.stringify(records, null, 2));
  return newRecord;
}

// Get history
export async function getHistory() {
  await initDb();
  const fileContent = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(fileContent);
}
