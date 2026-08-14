ALTER TABLE "subscription"
  ADD COLUMN IF NOT EXISTS "providerPriceId" text,
  ADD COLUMN IF NOT EXISTS "billingInterval" text,
  ADD COLUMN IF NOT EXISTS "canceledAt" timestamp,
  ADD COLUMN IF NOT EXISTS "lastProviderEventAt" timestamp;

CREATE INDEX IF NOT EXISTS "subscription_provider_customer_idx"
  ON "subscription" ("providerKey", "providerCustomerId");

CREATE TABLE IF NOT EXISTS "billing_webhook_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "eventId" text NOT NULL,
  "eventType" text NOT NULL,
  "occurredAt" timestamp,
  "processedAt" timestamp,
  "status" text DEFAULT 'received' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_webhook_event_provider_event_idx"
  ON "billing_webhook_event" ("provider", "eventId");

CREATE INDEX IF NOT EXISTS "billing_webhook_event_type_idx"
  ON "billing_webhook_event" ("provider", "eventType");
