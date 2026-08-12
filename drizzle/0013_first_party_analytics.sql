CREATE TABLE IF NOT EXISTS "analytics_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "eventName" text NOT NULL,
  "userId" text,
  "anonymousId" text,
  "sessionId" text,
  "occurredAt" timestamp DEFAULT now() NOT NULL,
  "source" text DEFAULT 'server' NOT NULL,
  "locale" text,
  "path" text,
  "planKey" text,
  "dedupeKey" text,
  "properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS "analytics_event_name_occurred_at_idx" ON "analytics_event" ("eventName", "occurredAt");
CREATE INDEX IF NOT EXISTS "analytics_event_user_occurred_at_idx" ON "analytics_event" ("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "analytics_event_anonymous_occurred_at_idx" ON "analytics_event" ("anonymousId", "occurredAt");
CREATE INDEX IF NOT EXISTS "analytics_event_session_occurred_at_idx" ON "analytics_event" ("sessionId", "occurredAt");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_event_user_name_dedupe_idx" ON "analytics_event" ("userId", "eventName", "dedupeKey") WHERE "dedupeKey" IS NOT NULL;
