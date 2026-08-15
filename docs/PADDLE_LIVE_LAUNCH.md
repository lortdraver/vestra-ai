# Paddle Live Launch Readiness

Vestra is prepared for Paddle Live configuration, but Live must not be enabled
until the owner deliberately approves the final cutover. The current production
environment should remain `PADDLE_ENVIRONMENT=sandbox`.

## Current Mode

- Development: `PADDLE_ENVIRONMENT=sandbox`
- Preview: `PADDLE_ENVIRONMENT=sandbox`
- Production now: `PADDLE_ENVIRONMENT=sandbox`
- Production later: `PADDLE_ENVIRONMENT=live` only after approval and preflight

Do not use real Live credentials during sandbox testing. Do not switch based on
hostname. Do not fall back from Live to Sandbox automatically.

## Environment Variables

Use the same variable names in each Vercel Environment, with values belonging to
that Paddle environment:

```bash
PADDLE_ENVIRONMENT=sandbox # or live after approval
PADDLE_API_KEY=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_WEBHOOK_SECRET=
PADDLE_PRO_MONTHLY_PRICE_ID=
PADDLE_PRO_ANNUAL_PRICE_ID=
PADDLE_REQUEST_TIMEOUT_MS=10000
PADDLE_PAST_DUE_GRACE_DAYS=3
```

Live and Sandbox values must never be mixed. The app fails closed for invalid
environment values, visibly mismatched credentials, mismatched API hosts, and
price IDs that visibly belong to a different environment.

## Live Product Checklist

Create these manually in Paddle Live when approved:

- Product: `Vestra Pro`
- Monthly price: EUR 4.99 per month
- Annual price: EUR 39.99 per year
- Tax category: the appropriate current digital/SaaS category
- Customer portal enabled
- Public website URLs reviewed

Do not hardcode Live price IDs in source code. Add them only to the approved
Vercel Production environment variables when the owner authorizes the switch.

## Minimum API-Key Permissions

Runtime required:

- Subscriptions: Write
- Customer portal sessions: Write
- Customers: Read
- Prices: Read
- Products: Read

Operations/debug only:

- Notification settings: Read
- Notifications: Read
- Transactions: Read

Webhook delivery also requires the Paddle webhook signing secret. Do not request
broad "All access" unless Paddle changes its permission model and this list is
re-audited.

## Live Webhook Destination

Canonical destination:

```text
https://vestraapp.uk/api/webhooks/paddle
```

Events:

- `transaction.completed`
- `transaction.payment_failed`
- `subscription.created`
- `subscription.activated`
- `subscription.updated`
- `subscription.canceled`
- `subscription.past_due`
- `subscription.paused`
- `subscription.resumed`
- `subscription.trialing`

Webhook verification uses only `PADDLE_WEBHOOK_SECRET` for the configured
environment. Sandbox webhooks must not validate with a Live secret, and Live
webhooks must not validate with a Sandbox secret.

## Website Approval Checklist

Prepare these manually in Paddle before requesting/using Live:

- Approved domain: `vestraapp.uk`
- Pricing page visible
- Privacy policy: `/privacy`
- Terms: `/terms`
- Refund/cancellation policy: `/refund`
- Support/contact channel configured
- Product description
- Statement descriptor
- Payment methods
- Tax category
- Customer portal
- Seller/business verification
- Payout setup

Do not invent legal or business identity details in the codebase.

## Payout Readiness

Owner-side Paddle setup:

- Seller verification complete
- Payout method configured
- Payout currency reviewed
- Bank/Payoneer setup complete where required
- Minimum payout threshold understood
- Statements/reconciliation process defined

Never store payout bank details in Vestra.

## Live Preflight

Run this before and after configuring Live variables:

```bash
pnpm billing:live-preflight
```

The preflight is read-only. It does not charge, mutate the database, create
Paddle resources, or make write calls. It checks environment selection,
required variables, app URL safety, Paddle API host consistency, legal routes,
webhook/checkout routes, and support/privacy contact configuration.

## Cutover Policy

When Production switches from Sandbox to Live:

- Existing Sandbox test subscriptions must not grant real Pro.
- Live subscriptions become authoritative.
- Old Sandbox rows remain in the database but are ignored for Live entitlement
  and billing actions.
- No user should retain Pro solely from Sandbox test state.
- Do not delete Sandbox records automatically.

Vestra stores the Paddle environment in subscription metadata as
`metadata.paddleEnvironment`. No migration is required for the current cutover
policy. A dedicated column can be added later if analytics/reporting needs
stronger indexed environment queries.

## Final Switch Procedure

Phase A: keep Production on Sandbox.

Phase B: configure Live credentials in Vercel only after owner approval.

Phase C: set `PADDLE_ENVIRONMENT=live`.

Phase D: redeploy.

Phase E: run `pnpm billing:live-preflight`.

Phase F: perform one controlled internal real payment.

Phase G: verify:

- Paddle transaction
- Paddle subscription
- webhook delivery
- Vestra subscription row with `metadata.paddleEnvironment="live"`
- Pro entitlement
- billing portal
- cancellation and resume flow

Phase H: open Live checkout to public users.

## Rollback Plan

If Live billing fails after launch:

- Disable or hide upgrade buttons through an explicit product/config action.
- Preserve existing active Live entitlements.
- Do not delete billing rows.
- Do not silently switch Production back to Sandbox after Live users exist.
- Use `pnpm billing:diagnose` and `pnpm billing:reconcile -- --email=...` for
  read-only diagnosis first.
- Reconcile only rows whose stored Paddle environment matches the configured
  environment.
