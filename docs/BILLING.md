# Billing And Monetization

Vestra Monetization v2 uses Paddle Billing in sandbox mode first. The Vestra
database remains the subscription source of truth. Browser checkout completion
never grants Pro by itself.

## Plans

Internal plan keys:

- `free`
- `premium`

Public product name:

- `premium` maps to Vestra Pro.

Pricing:

- Free: `€0`
- Vestra Pro Monthly: `€4.99/month`
- Vestra Pro Annual: `€39.99/year`

## Entitlements

Free:

- 30 wardrobe items
- 5 stylist generations per week
- 10 saved outfits
- basic planner/weather access
- one candidate where routes choose to limit generation

Pro:

- 300 wardrobe items
- 250 stylist generations per month as fair-use ceiling
- 500 saved outfits
- higher AI/background-removal fair-use limits
- 2-3 stylist candidates where wardrobe diversity permits
- weather-aware planner adaptation

Past-due subscriptions keep temporary Pro access for
`PADDLE_PAST_DUE_GRACE_DAYS` days. Canceled subscriptions with
`cancelAtPeriodEnd=true` keep Pro until `currentPeriodEnd`.

## Canonical State Machine

Internal states:

- `active`: Pro.
- `trialing`: Pro.
- `past_due`: Pro during the configured grace window, then Free.
- `paused`: Free.
- `canceled`: Pro only when cancellation is scheduled and the paid period has
  not ended.
- `inactive`: Free.

Separate lifecycle fields:

- `cancelAtPeriodEnd`
- `currentPeriodEnd`
- `scheduledChangeAction`
- `scheduledChangeAt`
- dynamic `accessUntil`
- dynamic `paymentIssue`

The policy lives in `lib/subscription/lifecycle.ts` and is reused by snapshots,
entitlements, account UI, pricing UI, and admin analytics.

## Environment

```env
PADDLE_ENVIRONMENT="sandbox"
PADDLE_API_KEY=""
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=""
PADDLE_WEBHOOK_SECRET=""
PADDLE_PRO_MONTHLY_PRICE_ID=""
PADDLE_PRO_ANNUAL_PRICE_ID=""
PADDLE_REQUEST_TIMEOUT_MS="10000"
PADDLE_PAST_DUE_GRACE_DAYS="3"
```

`PADDLE_PRO_MONTHLY_PRICE_ID` and `PADDLE_PRO_ANNUAL_PRICE_ID` must point to
the active Paddle Sandbox Vestra Pro prices. The current sandbox catalog is
EUR 4.99 monthly and EUR 39.99 annual; do not put API keys, webhook secrets, or
client tokens in committed files.

Optional:

```env
PADDLE_API_BASE_URL=""
```

Sandbox defaults to `https://sandbox-api.paddle.com`. Live mode is deliberately
rejected in Monetization v2.

## Checkout

Frontend sends only:

- `monthly`
- `annual`

The authenticated server route maps that choice to trusted env price IDs. The
checkout payload includes safe custom data:

- `vestraUserId`

It does not include passwords, auth tokens, wardrobe data, notes, prompts, or
payment details.

Users who already have active, trialing, or canceling Pro are blocked from
opening a duplicate checkout. Monthly/annual changes use the dedicated plan
switch flow.

## Lifecycle Actions

Cancel:

- `POST /api/billing/paddle/cancel`
- Calls Paddle `POST /subscriptions/{subscription_id}/cancel`.
- Uses `effective_from=next_billing_period`.
- Local Pro state changes only after verified webhook reconciliation.

Resume cancellation:

- `POST /api/billing/paddle/resume`
- Calls Paddle `PATCH /subscriptions/{subscription_id}` with
  `scheduled_change: null`.
- Used to undo a scheduled cancellation before period end.

Switch plan:

- `POST /api/billing/paddle/switch`
- Body: `{ "interval": "monthly" | "annual" }`.
- Calls Paddle `PATCH /subscriptions/{subscription_id}` with the trusted
  configured price ID and `proration_billing_mode=prorated_immediately`.
- Local plan/interval changes only after a provider-confirmed webhook.

Billing portal:

- `POST /api/billing/paddle/portal`
- Creates a customer portal session.
- Used for payment methods, invoices/receipts, and provider-hosted management.

## Webhook

Endpoint:

```text
https://www.vestraapp.uk/api/webhooks/paddle
```

Sandbox can use the same path on a preview or tunnel URL.

Paddle signatures are verified against the raw request body with
`PADDLE_WEBHOOK_SECRET`. The endpoint rejects invalid signatures and never logs
raw bodies, signatures, API keys, or billing addresses.

Supported events:

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

Webhook events are stored in `billing_webhook_event` with a unique
provider/event id for idempotency.

Out-of-order webhook events are ignored when their provider timestamp is older
than the subscription row's `lastProviderEventAt`. These are logged as:

```text
[paddle] WEBHOOK_STALE_EVENT_IGNORED
```

Minimal transaction history is stored in `billing_transaction` for transaction
IDs, status, amount, currency, subscription ID, and occurrence time. Vestra does
not store card data, billing address, or raw Paddle payloads.

## Operational Tools

Diagnose billing state without mutation:

```bash
pnpm billing:diagnose -- --email=user@example.com
```

Reconcile local state from Paddle:

```bash
pnpm billing:reconcile -- --email=user@example.com
pnpm billing:reconcile -- --email=user@example.com --apply
```

Both commands print sanitized summaries only. They do not print API keys, tokens,
full provider payloads, payment method data, or card details.

## User Matching

Vestra reconciles users by:

1. trusted `custom_data.vestraUserId` from authenticated checkout;
2. existing Paddle customer/subscription mapping.

Vestra never creates users from webhook data and does not rely only on email.

## Paddle Sandbox QA

1. Configure all Paddle sandbox env vars in Vercel.
2. Apply migration:

   ```bash
   pnpm db:apply
   ```

3. Redeploy.
4. Create the Paddle webhook destination:
   `https://www.vestraapp.uk/api/webhooks/paddle`.
5. Select the supported event checkboxes listed above.
6. Sign in as a Free user.
7. Open `/pricing`.
8. Choose Monthly Pro.
9. Complete Paddle sandbox checkout with Paddle test payment details.
10. Confirm the browser shows processing, not instant Pro.
11. Confirm webhook arrives and internal subscription becomes active.
12. Refresh Vestra and confirm Pro account state.
13. Open Manage subscription and verify the Paddle portal opens.
14. Cancel Monthly and verify cancellation/pending-end state after webhook.
15. Verify Pro remains active until period end.
16. Resume scheduled cancellation.
17. Switch Monthly to Annual.
18. Simulate payment failure and verify past-due UI and grace policy.
19. Simulate subscription pause and resume.
20. Send a duplicate webhook and verify idempotency.
21. Send an older out-of-order webhook and verify it is ignored.
22. Run reconciliation dry-run.
23. Repeat with Annual Pro.

## Minimal Paddle Permissions

The sandbox API key needs:

- `subscription.read`
- `subscription.write`
- `customer_portal_session.write`

Webhook delivery also needs the Paddle webhook signing secret. Checkout itself
is opened through Paddle.js with the client-side token and trusted price IDs
returned by Vestra.

## Before Live Launch

- Switch Paddle environment and credentials intentionally.
- Create live product/price IDs.
- Configure the live webhook destination and secret.
- Run full live-mode webhook verification with low-risk internal accounts.
- Review tax, invoice, refund, and support processes.
- Add monitoring for webhook failures and unmatched-user events.
