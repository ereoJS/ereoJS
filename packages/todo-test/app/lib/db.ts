import { Database } from 'bun:sqlite';
import { join } from 'node:path';

export interface Todo {
  id: number;
  title: string;
  completed: number; // SQLite boolean: 0 or 1
  created_at: string;
}

const DB_PATH = join(import.meta.dir, '../../data/todos.db');
const db = new Database(DB_PATH, { create: true });

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

export function getAllTodos(): Todo[] {
  return db.prepare(
    'SELECT * FROM todos ORDER BY completed ASC, created_at DESC'
  ).all() as Todo[];
}

export function getTodoById(id: number): Todo | null {
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Todo | null;
}

export function addTodo(title: string): Todo {
  return db.prepare(
    'INSERT INTO todos (title) VALUES (?) RETURNING *'
  ).get(title) as Todo;
}

export function toggleTodo(id: number): Todo | null {
  return db.prepare(
    'UPDATE todos SET completed = 1 - completed WHERE id = ? RETURNING *'
  ).get(id) as Todo | null;
}

export function deleteTodo(id: number): boolean {
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getTodoStats() {
  const rows = db.prepare(
    'SELECT completed, COUNT(*) as count FROM todos GROUP BY completed'
  ).all() as { completed: number; count: number }[];

  let total = 0, done = 0, pending = 0;
  for (const row of rows) {
    total += row.count;
    if (row.completed) done = row.count;
    else pending = row.count;
  }
  return { total, done, pending };
}

export default db;
