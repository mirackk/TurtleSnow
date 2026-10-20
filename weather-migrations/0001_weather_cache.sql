CREATE TABLE IF NOT EXISTS weather_cache (
 key TEXT PRIMARY KEY NOT NULL,
 value TEXT NOT NULL CHECK(json_valid(value)),
 stored_at TEXT NOT NULL DEFAULT (datetime('now'))
);
