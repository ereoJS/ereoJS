import { Database } from 'bun:sqlite';
import { join } from 'node:path';

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface TaskStats {
  todo: number;
  in_progress: number;
  done: number;
  total: number;
}

/**
 * SQLite database with production-ready configuration.
 *
 * The database file is stored in the /data directory so it can be
 * easily mounted as a Docker volume for persistence.
 */
const DB_PATH = join(import.meta.dir, '../../data/app.db');

const db = new Database(DB_PATH, { create: true });

// Production-ready PRAGMA settings
db.exec('PRAGMA journal_mode = WAL');        // Better concurrent reads
db.exec('PRAGMA synchronous = NORMAL');      // Safe with WAL, much faster
db.exec('PRAGMA foreign_keys = ON');         // Enforce referential integrity
db.exec('PRAGMA cache_size = -64000');       // ~64MB cache
db.exec('PRAGMA busy_timeout = 5000');       // Wait 5s on lock contention

// ── Schema migrations ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'todo'
                        CHECK (status IN ('todo', 'in_progress', 'done')),
    priority    TEXT    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
`);

// ── User operations ──────────────────────────────────────────────────

export function findUserByEmail(email: string): User | null {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | null;
}

export function findUserById(id: number): User | null {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null;
}

export function createUser(email: string, name: string, passwordHash: string): User {
  return db.prepare(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING *'
  ).get(email, name, passwordHash) as User;
}

export function emailExists(email: string): boolean {
  const row = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  return row !== null;
}

// ── Task operations ──────────────────────────────────────────────────

export function getTasksByUser(
  userId: number,
  status?: string
): Task[] {
  if (status && status !== 'all') {
    return db.prepare(
      `SELECT * FROM tasks WHERE user_id = ? AND status = ?
       ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
       created_at DESC`
    ).all(userId, status) as Task[];
  }
  return db.prepare(
    `SELECT * FROM tasks WHERE user_id = ?
     ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
     created_at DESC`
  ).all(userId) as Task[];
}

export function getTaskById(id: number, userId: number): Task | null {
  return db.prepare(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Task | null;
}

export function createTask(
  userId: number,
  title: string,
  description: string,
  status: string,
  priority: string
): Task {
  return db.prepare(
    'INSERT INTO tasks (user_id, title, description, status, priority) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).get(userId, title, description, status, priority) as Task;
}

export function updateTask(
  id: number,
  userId: number,
  title: string,
  description: string,
  status: string,
  priority: string
): Task | null {
  return db.prepare(
    "UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ? RETURNING *"
  ).get(title, description, status, priority, id, userId) as Task | null;
}

export function deleteTask(id: number, userId: number): boolean {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function getTaskStats(userId: number): TaskStats {
  const rows = db.prepare(
    'SELECT status, COUNT(*) as count FROM tasks WHERE user_id = ? GROUP BY status'
  ).all(userId) as { status: string; count: number }[];

  const stats: TaskStats = { todo: 0, in_progress: 0, done: 0, total: 0 };
  for (const row of rows) {
    stats[row.status as keyof TaskStats] = row.count;
    stats.total += row.count;
  }
  return stats;
}

// ── Password hashing — Bun built-in argon2id ─────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export default db;