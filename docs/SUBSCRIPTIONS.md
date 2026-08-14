# Subscription Architecture

Vestra subscriptions use the existing internal subscription model with Paddle
Billing added in sandbox mode for Monetization v1.

## Source Of Truth

The database is authoritative:

- browser checkout success never grants Pro;
- verified Paddle webhooks update internal subscription rows;
- entitlement checks read internal Vestra state.

## Plans

Internal plan keys:

- `free`
- `premium`

`premium` is shown publicly as Vestra Pro.

Free limits:

- 30 wardrobe items;
- 5 stylist generations per week;
- 10 saved outfits;
- basic planner/weather access.

Pro limits:

- 300 wardrobe items;
- 250 stylist generations per month;
- 500 saved outfits;
- higher fair-use AI/background-removal limits;
- full weather-aware planner adaptation.

## Status Policy

- `active`: Pro
- `trialing`: Pro
- `past_due`: temporary Pro grace policy
- `paused`: Free
- `canceled`: Pro only while `cancelAtPeriodEnd=true` and
  `currentPeriodEnd` is in the future
- `inactive` / `expired`: Free

## Database

Tables:

- `subscription_plan`
- `payment_provider`
- `subscription`
- `subscription_usage`
- `billing_webhook_event`
- `billing_transaction`

Migration:

```bash
pnpm db:apply
```

This includes `drizzle/0015_paddle_billing.sql` and
`drizzle/0016_billing_lifecycle.sql`.

## Lifecycle

The canonical lifecycle policy lives in `lib/subscription/lifecycle.ts`.

- `active`: Pro.
- `trialing`: Pro.
- `past_due`: Pro only during `PADDLE_PAST_DUE_GRACE_DAYS`.
- `paused`: Free.
- `canceled`: Pro until `currentPeriodEnd` only when cancellation was scheduled
  at period end.
- `inactive`: Free.

The policy returns a dynamic entitlement reason, payment issue flag, grace end,
and access end. Product routes should consume the shared entitlement helpers
rather than checking subscription status directly.

## Billing Operations

- `POST /api/billing/paddle/cancel` schedules cancellation at period end.
- `POST /api/billing/paddle/resume` removes the scheduled cancellation through
  Paddle.
- `POST /api/billing/paddle/switch` requests a monthly/annual interval change.
- `POST /api/billing/paddle/portal` opens Paddle-hosted billing management.

All provider mutations wait for verified webhook reconciliation before local
entitlements change.

## Operations

```bash
pnpm billing:diagnose -- --email=user@example.com
pnpm billing:reconcile -- --email=user@example.com
pnpm billing:reconcile -- --email=user@example.com --apply
```

Diagnostics are sanitized and reconciliation is dry-run by default.

## Entitlements

Reusable server-side helpers live in `lib/subscription/entitlements.ts`.

Enforced boundaries:

- wardrobe item creation;
- stylist generation;
- saved outfit creation;
- Pro-only weather adaptation for planner outfits.

Stable errors:

- `plan_limit_reached`
- `pro_required`
- `stylist_limit_reached`
- `wardrobe_limit_reached`
- `saved_outfit_limit_reached`

## Paddle

Paddle configuration and webhook processing live in `lib/billing`.

Routes:

- `POST /api/billing/paddle/checkout`
- `POST /api/billing/paddle/portal`
- `POST /api/webhooks/paddle`

Checkout accepts only `monthly` or `annual`. Server config maps those choices to
trusted Paddle price IDs.

## Admin

Admin analytics reads internal subscription rows and reports:

- Free users;
- Pro users;
- trial users;
- monthly Pro;
- annual Pro;
- past-due users;
- canceled / pending-period-end users.

MRR is intentionally not calculated in v1 because tax, fees, refunds, coupons,
and multi-currency behavior are not modeled yet.
