-- Seller listings must prove their contact email before going live, pass automatic
-- checks, and can be reported by buyers. `moderation` mirrors the JSON field for queries:
-- NULL or 'none' and 'approved' are public; 'pending', 'hidden' and 'rejected' are not.
ALTER TABLE listings ADD COLUMN moderation TEXT;
ALTER TABLE listings ADD COLUMN contact_email_hash TEXT;

CREATE INDEX IF NOT EXISTS listings_moderation_idx ON listings(moderation, updated_at DESC);
CREATE INDEX IF NOT EXISTS listings_contact_idx ON listings(contact_email_hash, published_at);

-- One live code per listing. Only the hash is stored.
CREATE TABLE IF NOT EXISTS listing_email_codes (
  listing_id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- One report per listing and reporter; reporters are hashed client keys.
CREATE TABLE IF NOT EXISTS listing_reports (
  listing_id TEXT NOT NULL,
  reporter_hash TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'scam', 'wrong', 'unavailable', 'other')),
  note TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (listing_id, reporter_hash)
);

CREATE INDEX IF NOT EXISTS listing_reports_listing_idx ON listing_reports(listing_id, created_at DESC);
