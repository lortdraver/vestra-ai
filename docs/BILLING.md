# Billing And Monetization

Vestra Monetization v1 uses Paddle Billing in sandbox mode first. The Vestra
database remains the subscription source of truth. Browser checkout completion
never grants Pro by itself.

## Plans

Internal plan keys:

- `free`
- `premium`

Public product name:

- `premium` maps to Vestra Pro.

Pricing:

- Free: `$0`
- Vestra Pro Monthly: `$4.99/month`
- Vestra Pro Annual: `$39.99/year`

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

Past-due subscriptions keep temporary Pro access as a grace policy. Canceled
subscriptions with `cancelAtPeriodEnd=true` keep Pro until `currentPeriodEnd`.

## Environment

```env
PADDLE_ENVIRONMENT="sandbox"
PADDLE_API_KEY=""
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=""
PADDLE_WEBHOOK_SECRET=""
PADDLE_PRO_MONTHLY_PRICE_ID=""
PADDLE_PRO_ANNUAL_PRICE_ID=""
PADDLE_REQUEST_TIMEOUT_MS="10000"
```

Optional:

```env
PADDLE_API_BASE_URL=""
```

Sandbox defaults to `https://sandbox-api.paddle.com`. Live defaults to
`https://api.paddle.com`, but live mode is not enabled in this milestone.

## Checkout

Frontend sends only:

- `monthly`
- `annual`

The authenticated server route maps that choice to trusted env price IDs. The
checkout payload includes safe custom data:

- `vestraUserId`

It does not include passwords, auth tokens, wardrobe data, notes, prompts, or
payment details.

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
14. Cancel in the portal and verify cancellation/pending-end state after webhook.
15. Simulate payment failure and duplicate webhook delivery.
16. Repeat with Annual Pro.

## Minimal Paddle Permissions

The API key needs permission to create customer portal sessions and read billing
objects used by webhook reconciliation. Checkout itself is opened through
Paddle.js with the client-side token and trusted price IDs returned by Vestra.

## Before Live Launch

- Switch Paddle environment and credentials intentionally.
- Create live product/price IDs.
- Configure the live webhook destination and secret.
- Run full live-mode webhook verification with low-risk internal accounts.
- Review tax, invoice, refund, and support processes.
- Add monitoring for webhook failures and unmatched-user events.
