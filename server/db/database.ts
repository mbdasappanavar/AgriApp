import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: Database | null = null;
let inTransaction = false;
let saveTimer: NodeJS.Timeout | null = null;
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'agri_store.db');

export async function getDb(): Promise<Database> {
  if (db) return db;

  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: (file) => {
      if (fs.existsSync(wasmPath)) return wasmPath;
      return file;
    }
  });
  const dirPath = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const filebuffer = fs.readFileSync(DB_FILE_PATH);
      db = new SQL.Database(filebuffer);
    } catch (e) {
      console.error("Error opening existing database file, initializing fresh DB:", e);
      try { fs.unlinkSync(DB_FILE_PATH); } catch (_) {}
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");
  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dirPath = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error("Failed to save database to disk:", err);
  }
}

export function saveDbDebounced(delay = 500): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDb();
  }, delay);
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error("Database not initialized");
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params: any[] = []): { changes: number } {
  if (!db) throw new Error("Database not initialized");
  db.run(sql, params);
  let changes = 0;
  try {
    const result = db.exec("SELECT changes() as changes")[0];
    changes = result && result.values && result.values[0] ? (result.values[0][0] as number) : 0;
  } catch (_) {}

  if (!inTransaction) {
    saveDbDebounced();
  }
  return { changes };
}

export function transaction<T>(fn: () => T): T {
  if (!db) throw new Error("Database not initialized");
  inTransaction = true;
  db.run("BEGIN TRANSACTION;");
  try {
    const result = fn();
    db.run("COMMIT;");
    inTransaction = false;
    saveDb();
    return result;
  } catch (error) {
    inTransaction = false;
    try { db.run("ROLLBACK;"); } catch (_) {}
    console.error("Transaction rolled back due to error:", error);
    throw error;
  }
}
