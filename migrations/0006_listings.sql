-- Marketplace listings: seller drafts, published offers and imported offers.
-- `data` holds the full listing JSON. The scalar columns exist for filtering.
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  origin TEXT NOT NULL CHECK (origin IN ('seller', 'imported')),
  market TEXT,
  property_type TEXT NOT NULL,
  price INTEGER,
  area REAL,
  lat REAL,
  lon REAL,
  source_url TEXT,
  report_id TEXT,
  edit_token_hash TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS listings_source_url_idx ON listings(source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS listings_market_idx ON listings(status, market, published_at DESC);

-- Seller photos. The browser resizes before upload, so each row stays well under the D1 row limit.
CREATE TABLE IF NOT EXISTS listing_photos (
  id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('full', 'thumb')),
  content_type TEXT NOT NULL,
  bytes BLOB NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (id, variant)
);

CREATE INDEX IF NOT EXISTS listing_photos_listing_idx ON listing_photos(listing_id);

-- Daily counters per hashed client, so one visitor cannot flood drafts or uploads.
CREATE TABLE IF NOT EXISTS listing_rate (
  subject TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (subject, day, kind)
);
