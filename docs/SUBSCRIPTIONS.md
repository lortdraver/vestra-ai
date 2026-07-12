# Subscription Architecture

## Scope

Milestone 5 introduces subscription architecture without real payment
processing.

Implemented:

- Free and Premium plan definitions.
- Subscription database schema.
- Usage limit and feature flag helpers.
- Premium trial support for 7 days.
- Payment provider abstraction.
- Dashboard subscription UI.
- Tests for plan behavior, limits, trials, and provider abstraction.

Not implemented yet:

- real Stripe checkout;
- real Payriff checkout;
- real Epoint checkout;
- webhook processing;
- billing portal;
- automatic plan enforcement in product flows;
- invoices, refunds, tax, or coupons.

## Plans

### Free

The Free plan keeps Vestra useful without payment.

Limits:

- wardrobe items: 50;
- AI analyses per month: 20;
- stylist requests per month: 10;
- background removals per month: 20;
- saved outfits: 10.

Features:

- wardrobe core;
- basic AI analysis;
- basic stylist.

### Premium

The Premium plan is designed for active users.

Limits:

- unlimited wardrobe items;
- unlimited AI analyses;
- unlimited stylist requests;
- unlimited background removals;
- unlimited saved outfits.

Features:

- wardrobe core;
- basic and advanced AI analysis;
- basic and unlimited stylist;
- wardrobe insights;
- premium support;
- virtual try-on readiness.

Trial:

- 7 days.

## Database

Tables:

- `subscription_plan` - available plans, features, limits, pricing metadata,
  and trial length.
- `payment_provider` - configured payment provider records.
- `subscription` - user subscription state and provider metadata.
- `subscription_usage` - per-user usage counters by feature and period.

All user-owned subscription data includes `userId`.

Apply the schema:

```bash
pnpm db:apply
```

This applies `drizzle/0005_subscription_architecture.sql`.

## Domain Modules

Subscription modules live in `lib/subscription`.

Key exports:

- `subscriptionPlans`
- `getSubscriptionPlan`
- `hasFeature`
- `checkUsage`
- `isTrialActive`
- `createTrialWindow`
- `getSubscriptionSnapshot`

Payment modules live in `lib/payments`.

Providers:

- `StripeProvider`
- `PayriffProvider`
- `EpointProvider`
- `ManualProvider`

Provider responses are intentionally inert until real payment processing is
approved.

## UI

The dashboard layout renders `SubscriptionOverview`.

It shows:

- current plan badge;
- upgrade/premium banner;
- usage counters;
- trial status;
- Premium state.

If subscription tables are not available yet, the dashboard falls back to a Free
snapshot instead of breaking existing development flows.

## Enforcement Strategy

Milestone 5 does not enforce product limits inside wardrobe or stylist flows.
This preserves M1-M4.5 behavior.

Future enforcement should happen at API boundaries:

- wardrobe create;
- AI analysis trigger;
- background removal;
- stylist generation;
- save outfit.

Each enforcement point should:

1. read the authenticated user;
2. load the subscription snapshot;
3. call `checkUsage`;
4. reject with a localized upgrade response when blocked;
5. increment usage only after successful work.

## Production Notes

- Do not enable real provider checkout without webhook validation.
- Do not trust client-side plan state.
- Store provider customer/subscription IDs only after webhook confirmation.
- Keep manual activation restricted to admin/internal workflows.
- Add rate limits before public launch.
- Add billing audit logs before real payments.
