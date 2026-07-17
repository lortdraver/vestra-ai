# Email Verification

Vestra uses Better Auth's official email verification workflow for
email/password accounts. Vestra does not maintain a parallel verification token
system.

## Architecture

- Better Auth generates secure, expiring verification tokens.
- Better Auth verifies links through its auth route and updates
  `user.emailVerified`.
- Vestra formats localized AZ, EN, and RU email templates.
- Vestra sends email through a server-only account email provider abstraction.
- Vestra rate-limits resend requests by user, email, and IP.
- Vestra guards sensitive write actions server-side with a reusable verified
  email helper.

Existing scaffold tables such as `email_verification_request` remain available
for future account-system work, but they are not used for the active Better Auth
verification flow.

## Providers

### Local Development

```env
EMAIL_PROVIDER="manual"
```

Manual mode does not send email and is blocked in production. Development logs
include only the message kind, recipient, subject, and action path. Tokens and
complete verification URLs are never logged.

### Production

```env
EMAIL_PROVIDER="resend"
EMAIL_FROM="Vestra <noreply@your-domain.com>"
EMAIL_REPLY_TO="support@your-domain.com"
RESEND_API_KEY="<server-only-resend-api-key>"
EMAIL_REQUEST_TIMEOUT_MS="10000"
EMAIL_VERIFICATION_EXPIRES_SECONDS="86400"
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS="60"
```

Provider secrets must never be exposed to client code.

## User Flow

1. A new email/password user registers.
2. Better Auth creates the account with `emailVerified=false`.
3. Vestra sends a localized verification email after signup.
4. The user opens the Better Auth verification link.
5. Better Auth marks the email verified and redirects to
   `/verify-email?status=success`.
6. The user can access sensitive actions such as wardrobe uploads, stylist
   generation, and stylist preference changes.

If the token is expired or invalid, the verification page shows a localized
result state. Signed-in unverified users see a dashboard banner with a resend
action.

Unverified users may keep a normal session so they can see the dashboard,
language controls, and resend prompt. Sensitive write operations are enforced
server-side and return `email_not_verified` until verification succeeds.

## Protected Actions

The reusable guard returns stable code `email_not_verified` and is applied to:

- `POST /api/wardrobe/items`
- `POST /api/stylist/generate`
- `PATCH /api/stylist/preferences`

Client screens map `email_not_verified` to localized AZ, EN, and RU messages.

## Safe Legacy Policy

The schema already contained `user.emailVerified` before verification was
enforced. Existing credential users may therefore have `false` because
verification did not previously exist.

Migration:

```bash
pnpm db:apply
```

Migration file:

```text
drizzle/0011_email_verification_legacy_policy.sql
```

The migration marks existing credential users verified. New users created after
the rollout must verify their email before sensitive product actions are
allowed.

## Manual Production Test

1. Configure production Vercel variables from `docs/ENVIRONMENT.md`.
2. Apply migrations with `pnpm db:apply`.
3. Register a new email/password account.
4. Confirm the account is created with `emailVerified=false`.
5. Confirm the email arrives and the link uses the configured production domain.
6. Confirm the link redirects to `/verify-email?status=success`.
7. Confirm `user.emailVerified=true` in Neon.
8. Sign in and confirm wardrobe upload and stylist generation are allowed.
9. Create another unverified user and confirm protected actions return
   `email_not_verified`.
