CREATE TABLE IF NOT EXISTS report_sources (
  report_id TEXT PRIMARY KEY NOT NULL,
  source_text TEXT NOT NULL,
  saved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_revisions (
  report_id TEXT NOT NULL,
  extraction_version INTEGER NOT NULL,
  data TEXT NOT NULL,
  replaced_at TEXT NOT NULL,
  PRIMARY KEY(report_id, extraction_version)
);
