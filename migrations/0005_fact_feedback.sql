CREATE TABLE IF NOT EXISTS fact_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  report_id TEXT NOT NULL,
  field TEXT NOT NULL,
  reported_value TEXT,
  suggested_value TEXT,
  comment TEXT,
  extraction_version INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_feedback_report_created_idx ON fact_feedback(report_id, created_at);

-- Counts only. subject_key is a salted hash of IP and report id. The IP is never stored.
CREATE TABLE IF NOT EXISTS fact_feedback_limits (
  subject_key TEXT NOT NULL,
  window_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL,
  PRIMARY KEY (subject_key, window_start)
);
