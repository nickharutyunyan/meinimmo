CREATE TABLE IF NOT EXISTS mortgage_rate_snapshots (
  source TEXT PRIMARY KEY NOT NULL,
  rate REAL NOT NULL,
  observed_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
