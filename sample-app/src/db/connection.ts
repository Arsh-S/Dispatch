import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(__dirname, '../../data.db'));
    db.pragma('journal_mode = WAL');
  }
  return db;
}
