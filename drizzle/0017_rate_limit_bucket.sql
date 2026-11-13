-- Shared, multi-instance rate limiting (replaces per-process in-memory buckets).
CREATE TABLE IF NOT EXISTS "rate_limit_bucket" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "resetAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_bucket_reset_at_idx"
  ON "rate_limit_bucket" ("resetAt");
