PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign_in', 'verify_email', 'password_reset')),
  email TEXT NOT NULL COLLATE NOCASE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  nonce_hash TEXT,
  return_to TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS email_tokens_live_idx ON email_tokens(email, purpose, expires_at);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

UPDATE users SET email_verified_at = created_at
WHERE email_verified_at IS NULL
  AND EXISTS (
    SELECT 1 FROM oauth_accounts
    WHERE oauth_accounts.user_id = users.id AND oauth_accounts.provider = 'google'
  )
  AND NOT EXISTS (
    SELECT 1 FROM password_credentials WHERE password_credentials.user_id = users.id
  );
