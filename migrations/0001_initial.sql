CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS comparisons (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS comparisons_created_at_idx ON comparisons(created_at DESC);
