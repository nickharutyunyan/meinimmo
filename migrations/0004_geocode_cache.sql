-- Nominatim results, keyed by the normalised query. The application treats
-- rows older than 30 days as a miss. The rate-limit row spaces live lookups.
CREATE TABLE IF NOT EXISTS geocode_cache (
  query_key TEXT PRIMARY KEY NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  label TEXT NOT NULL,
  neighborhood TEXT,
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS geocode_rate_limit (
  id TEXT PRIMARY KEY NOT NULL,
  last_request_at INTEGER NOT NULL
);
