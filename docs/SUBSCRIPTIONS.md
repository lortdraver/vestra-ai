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

Migration:

```bash
pnpm db:apply
```

This includes `drizzle/0015_paddle_billing.sql`.

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
