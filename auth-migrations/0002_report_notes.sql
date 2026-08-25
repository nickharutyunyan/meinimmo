PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report_notes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, report_id)
);

CREATE INDEX IF NOT EXISTS report_notes_updated_idx ON report_notes(user_id, updated_at DESC);
