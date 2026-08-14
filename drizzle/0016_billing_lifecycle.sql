ALTER TABLE "subscription"
  ADD COLUMN IF NOT EXISTS "scheduledChangeAction" text,
  ADD COLUMN IF NOT EXISTS "scheduledChangeAt" timestamp;

CREATE TABLE IF NOT EXISTS "billing_transaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "provider" text NOT NULL,
  "providerTransactionId" text NOT NULL,
  "providerSubscriptionId" text,
  "status" text NOT NULL,
  "currency" text,
  "amount" integer,
  "occurredAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_transaction_provider_transaction_idx"
  ON "billing_transaction" ("provider", "providerTransactionId");

CREATE INDEX IF NOT EXISTS "billing_transaction_user_idx"
  ON "billing_transaction" ("userId");
