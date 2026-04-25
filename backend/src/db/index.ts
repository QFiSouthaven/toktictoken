import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type DB = DatabaseSync;
export type Stmt = StatementSync;

export function openDb(dataDir: string, passwordHash: string): DB {
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, 'openclaw.sqlite');
  const db = new DatabaseSync(dbPath);

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  const hasUser = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (hasUser.c === 0) {
    db.prepare('INSERT INTO users (password_hash, created_at) VALUES (?, ?)').run(
      passwordHash,
      Date.now(),
    );
  }

  return db;
}

export function withTx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }
}
