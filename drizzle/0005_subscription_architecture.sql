CREATE TABLE IF NOT EXISTS "payment_provider" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'inactive',
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_provider_key_idx"
  ON "payment_provider" ("key");

CREATE TABLE IF NOT EXISTS "subscription_plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "priceMonthlyCents" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'USD',
  "features" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "trialDays" integer NOT NULL DEFAULT 7,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_plan_key_idx"
  ON "subscription_plan" ("key");

CREATE INDEX IF NOT EXISTS "subscription_plan_active_idx"
  ON "subscription_plan" ("isActive");

CREATE TABLE IF NOT EXISTS "subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "planKey" text NOT NULL DEFAULT 'free',
  "status" text NOT NULL DEFAULT 'active',
  "providerKey" text NOT NULL DEFAULT 'manual',
  "providerCustomerId" text,
  "providerSubscriptionId" text,
  "trialStartedAt" timestamp,
  "trialEndsAt" timestamp,
  "currentPeriodStart" timestamp,
  "currentPeriodEnd" timestamp,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_user_id_idx"
  ON "subscription" ("userId");

CREATE INDEX IF NOT EXISTS "subscription_user_status_idx"
  ON "subscription" ("userId", "status");

CREATE INDEX IF NOT EXISTS "subscription_provider_subscription_idx"
  ON "subscription" ("providerKey", "providerSubscriptionId");

CREATE TABLE IF NOT EXISTS "subscription_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "subscriptionId" uuid,
  "featureKey" text NOT NULL,
  "periodStart" timestamp NOT NULL,
  "periodEnd" timestamp NOT NULL,
  "used" integer NOT NULL DEFAULT 0,
  "limitValue" integer,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_usage_user_feature_period_idx"
  ON "subscription_usage" ("userId", "featureKey", "periodStart");

CREATE INDEX IF NOT EXISTS "subscription_usage_subscription_idx"
  ON "subscription_usage" ("subscriptionId");

INSERT INTO "payment_provider" ("key", "name", "status")
VALUES
  ('manual', 'Manual', 'active'),
  ('stripe', 'Stripe', 'inactive'),
  ('payriff', 'Payriff', 'inactive'),
  ('epoint', 'Epoint', 'inactive')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "subscription_plan" (
  "key",
  "name",
  "description",
  "priceMonthlyCents",
  "currency",
  "features",
  "limits",
  "trialDays"
)
VALUES
  (
    'free',
    'Free',
    'Core wardrobe and limited AI usage.',
    0,
    'USD',
    '["wardrobe_core","basic_ai_analysis","basic_stylist"]'::jsonb,
    '{"wardrobe_items":50,"ai_analyses_monthly":20,"stylist_requests_monthly":10,"background_removals_monthly":20,"saved_outfits":10}'::jsonb,
    0
  ),
  (
    'premium',
    'Premium',
    'Expanded AI usage, wardrobe intelligence, and premium planning features.',
    999,
    'USD',
    '["wardrobe_core","basic_ai_analysis","basic_stylist","advanced_ai_analysis","unlimited_stylist","wardrobe_insights","premium_support","virtual_try_on_ready"]'::jsonb,
    '{"wardrobe_items":null,"ai_analyses_monthly":null,"stylist_requests_monthly":null,"background_removals_monthly":null,"saved_outfits":null}'::jsonb,
    7
  )
ON CONFLICT ("key") DO NOTHING;
