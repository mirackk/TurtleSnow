CREATE TABLE IF NOT EXISTS feedback (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 category TEXT NOT NULL,
 message TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 resort TEXT NOT NULL DEFAULT '',
 language TEXT NOT NULL,
 ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_rate ON feedback(ip_hash,created_at);
