import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

// 数据目录从项目根解析（docs/data/）
const DATA_DIR = join(process.cwd(), 'docs', 'data');
const DB_PATH = join(DATA_DIR, 'docs.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      author      TEXT NOT NULL DEFAULT '',
      reviewer    TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'published',
      last_reviewed TEXT NOT NULL DEFAULT '',
      review_date  TEXT NOT NULL DEFAULT '',
      review_comment TEXT NOT NULL DEFAULT '',
      review_history TEXT NOT NULL DEFAULT '[]',
      target_path TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_docs_slug ON docs(slug);
    CREATE INDEX IF NOT EXISTS idx_docs_status ON docs(status);
  `);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
