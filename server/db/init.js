import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'neon-alarm.db');

let db;

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#00ffff',
      categories TEXT NOT NULL DEFAULT 'custom',
      is_system_default INTEGER DEFAULT 0,
      is_recurring INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  // Add recurring column to tags if not exists
  try { db.exec(`ALTER TABLE tags ADD COLUMN is_recurring INTEGER DEFAULT 0`); } catch (_) {}

  // Rename category to categories if needed
  try { db.exec(`ALTER TABLE tags RENAME COLUMN category TO categories`); } catch (_) {}

  // Ensure Recurring tag has is_recurring = 1
  try { db.exec(`UPDATE tags SET is_recurring = 1 WHERE name = 'Recurring' AND categories LIKE '%recurring%'`); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS alarms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5',
      tag_id INTEGER,
      is_active INTEGER DEFAULT 1,
      label TEXT,
      snooze_minutes INTEGER DEFAULT 5,
      parent_alarm_id INTEGER,
      is_locked INTEGER DEFAULT 1,
      start_date TEXT,
      recurring INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_alarm_id) REFERENCES alarms(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_day_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      is_work_day INTEGER NOT NULL,
      answered_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'Default',
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '17:00',
      has_lunch INTEGER DEFAULT 1,
      lunch_start TEXT DEFAULT '12:00',
      lunch_end TEXT DEFAULT '13:00',
      has_morning_break INTEGER DEFAULT 0,
      morning_break_start TEXT DEFAULT '10:15',
      morning_break_end TEXT DEFAULT '10:30',
      has_afternoon_break INTEGER DEFAULT 0,
      afternoon_break_start TEXT DEFAULT '15:00',
      afternoon_break_end TEXT DEFAULT '15:15',
      reminders_before_start INTEGER DEFAULT 30,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try { db.run('ALTER TABLE alarms ADD COLUMN parent_alarm_id INTEGER'); } catch (_) {}
  try { db.run('ALTER TABLE alarms ADD COLUMN is_locked INTEGER DEFAULT 1'); } catch (_) {}
  try { db.run('ALTER TABLE alarms ADD COLUMN arc_id INTEGER'); } catch (_) {}
  try { db.run('ALTER TABLE alarms ADD COLUMN start_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE alarms ADD COLUMN recurring INTEGER DEFAULT 1'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN start_date TEXT'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN recurring INTEGER DEFAULT 1'); } catch (_) {}
  try { db.run('ALTER TABLE work_schedules ADD COLUMN has_morning_break INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE work_schedules ADD COLUMN morning_break_start TEXT DEFAULT "10:15"'); } catch (_) {}
  try { db.run('ALTER TABLE work_schedules ADD COLUMN morning_break_end TEXT DEFAULT "10:30"'); } catch (_) {}
  try { db.run('ALTER TABLE work_schedules ADD COLUMN has_afternoon_break INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE work_schedules ADD COLUMN afternoon_break_start TEXT DEFAULT "15:00"'); } catch (_) {}
  try { db.run('ALTER TABLE work_schedules ADD COLUMN afternoon_break_end TEXT DEFAULT "15:15"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN has_lunch INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN lunch_start TEXT DEFAULT "12:00"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN lunch_end TEXT DEFAULT "13:00"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN has_morning_break INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN morning_break_start TEXT DEFAULT "10:15"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN morning_break_end TEXT DEFAULT "10:30"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN has_afternoon_break INTEGER DEFAULT 0'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN afternoon_break_start TEXT DEFAULT "15:00"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN afternoon_break_end TEXT DEFAULT "15:15"'); } catch (_) {}
  try { db.run('ALTER TABLE arcs ADD COLUMN reminders_before_start INTEGER DEFAULT 0'); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alarm_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      recurrence_type TEXT NOT NULL DEFAULT 'daily',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS arcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tag_id INTEGER,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'single',
      label TEXT,
      days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5',
      is_active INTEGER DEFAULT 1,
      has_lunch INTEGER DEFAULT 0,
      lunch_start TEXT DEFAULT '12:00',
      lunch_end TEXT DEFAULT '13:00',
      has_morning_break INTEGER DEFAULT 0,
      morning_break_start TEXT DEFAULT '10:15',
      morning_break_end TEXT DEFAULT '10:30',
      has_afternoon_break INTEGER DEFAULT 0,
      afternoon_break_start TEXT DEFAULT '15:00',
      afternoon_break_end TEXT DEFAULT '15:15',
      reminders_before_start INTEGER DEFAULT 0,
      start_date TEXT,
      recurring INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alarm_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      alarm_id INTEGER NOT NULL,
      exception_date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE,
      UNIQUE(user_id, alarm_id, exception_date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS arc_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      arc_id INTEGER NOT NULL,
      exception_date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (arc_id) REFERENCES arcs(id) ON DELETE CASCADE,
      UNIQUE(user_id, arc_id, exception_date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_suspension (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      resume_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS day_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    )
  `);

  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
  db.run('PRAGMA foreign_keys = ON');
}

export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results[0] || null;
}

export function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
  saveDb();
  return { changes, lastInsertRowid };
}
