import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sqliteVec from 'sqlite-vec';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DB = Database.Database;

export function openDb(dataDir: string, passwordHash: string): DB {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, 'openclaw.sqlite');
  const db = new Database(dbPath);

  try {
    sqliteVec.load(db);
  } catch (err) {
    console.warn('sqlite-vec failed to load; RAG search will be disabled:', (err as Error).message);
  }

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  try {
    db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(chunk_id INTEGER PRIMARY KEY, embedding FLOAT[768])",
    );
  } catch (err) {
    console.warn('vec_chunks virtual table unavailable:', (err as Error).message);
  }

  const hasUser = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (hasUser.c === 0) {
    db.prepare('INSERT INTO users (password_hash, created_at) VALUES (?, ?)').run(
      passwordHash,
      Date.now(),
    );
  }

  return db;
}
