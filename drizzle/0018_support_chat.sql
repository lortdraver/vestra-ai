-- In-app support chat between users and the Vestra team.
CREATE TABLE IF NOT EXISTS "support_thread" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'open',
  "unreadByAdmin" boolean NOT NULL DEFAULT false,
  "unreadByUser" boolean NOT NULL DEFAULT false,
  "lastMessageAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_thread_user_idx"
  ON "support_thread" ("userId");
CREATE INDEX IF NOT EXISTS "support_thread_last_message_idx"
  ON "support_thread" ("lastMessageAt");

CREATE TABLE IF NOT EXISTS "support_message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "threadId" uuid NOT NULL REFERENCES "support_thread"("id") ON DELETE CASCADE,
  "senderRole" text NOT NULL,
  "senderId" text REFERENCES "user"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_message_thread_created_idx"
  ON "support_message" ("threadId", "createdAt");
