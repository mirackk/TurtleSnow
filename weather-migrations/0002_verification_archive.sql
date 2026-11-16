-- Compact hourly snapshots, bounded to 60 days by the scheduled Worker.
CREATE TABLE IF NOT EXISTS forecast_archive (
 resort TEXT NOT NULL,
 captured_at TEXT NOT NULL,
 variant TEXT NOT NULL,
 pipeline_version TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 PRIMARY KEY(resort,captured_at,variant)
);
CREATE INDEX IF NOT EXISTS forecast_archive_retention ON forecast_archive(captured_at);
CREATE TABLE IF NOT EXISTS report_archive (
 resort TEXT NOT NULL,
 reported_at TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 first_seen_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 PRIMARY KEY(resort,reported_at,content_hash)
);
CREATE INDEX IF NOT EXISTS report_archive_retention ON report_archive(last_seen_at);
