import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = path.join(rootDir, 'data');
export const photosDir = path.join(dataDir, 'photos');
mkdirSync(photosDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'clinic.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    photo_path TEXT,
    photo_background TEXT NOT NULL DEFAULT 'rainbow',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_visit_at TEXT,
    total_stickers INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS journey_states (
    patient_id TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
    journey_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    journey_token TEXT NOT NULL UNIQUE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    symptoms_json TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    diagnosis_code TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS department_results (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT NOT NULL,
    score INTEGER NOT NULL,
    sticker TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    type TEXT NOT NULL,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    energy_level INTEGER,
    mood TEXT,
    note TEXT,
    reward TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    UNIQUE(patient_id, source_id)
  );
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id, completed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_followups_patient ON follow_ups(patient_id, due_at);
`);

const resultColumns = db.prepare('PRAGMA table_info(department_results)').all();
if (!resultColumns.some((column) => column.name === 'result_json')) {
  db.exec('ALTER TABLE department_results ADD COLUMN result_json TEXT');
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function patientFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    age: String(row.age),
    photoUrl: row.photo_path ? `/photos/${path.basename(row.photo_path)}` : '',
    photoBackground: row.photo_background,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVisitAt: row.last_visit_at,
    totalStickers: row.total_stickers,
    visitCount: row.visit_count ?? 0,
    pendingFollowUps: row.pending_follow_ups ?? 0,
  };
}
