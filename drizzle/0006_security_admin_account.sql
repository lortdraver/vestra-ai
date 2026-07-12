ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS "user_role_idx"
  ON "user" ("role");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actorUserId" text,
  "targetUserId" text,
  "action" text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" text,
  "ipAddress" text,
  "userAgent" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_actor_created_at_idx"
  ON "audit_log" ("actorUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "audit_log_action_created_at_idx"
  ON "audit_log" ("action", "createdAt");

CREATE TABLE IF NOT EXISTS "security_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text,
  "email" text,
  "eventType" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'info',
  "ipAddress" text,
  "userAgent" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "security_event_type_created_at_idx"
  ON "security_event" ("eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "security_event_user_created_at_idx"
  ON "security_event" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "security_event_email_created_at_idx"
  ON "security_event" ("email", "createdAt");

CREATE TABLE IF NOT EXISTS "account_recovery_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "tokenHash" text NOT NULL UNIQUE,
  "purpose" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "consumedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "account_recovery_token_user_purpose_idx"
  ON "account_recovery_token" ("userId", "purpose");

CREATE INDEX IF NOT EXISTS "account_recovery_token_expires_at_idx"
  ON "account_recovery_token" ("expiresAt");

CREATE TABLE IF NOT EXISTS "email_verification_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "email" text NOT NULL,
  "tokenHash" text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "verifiedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_verification_request_user_created_at_idx"
  ON "email_verification_request" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "email_verification_request_token_hash_idx"
  ON "email_verification_request" ("tokenHash");
