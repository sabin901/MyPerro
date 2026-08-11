CREATE TABLE IF NOT EXISTS installations (
  id_hash TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'macos', 'linux')),
  architecture TEXT NOT NULL,
  app_version TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS installations_last_seen_idx ON installations(last_seen);
CREATE INDEX IF NOT EXISTS installations_platform_idx ON installations(platform, last_seen);
CREATE INDEX IF NOT EXISTS installations_version_idx ON installations(app_version, last_seen);
