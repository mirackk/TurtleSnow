CREATE TABLE IF NOT EXISTS summary_runs (
 resort TEXT NOT NULL,
 slot TEXT NOT NULL,
 day TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(resort,slot)
);
CREATE INDEX IF NOT EXISTS summary_day ON summary_runs(day);
