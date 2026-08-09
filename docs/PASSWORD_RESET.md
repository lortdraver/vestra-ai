# Password Reset

Vestra uses Better Auth's native password reset flow. Vestra does not maintain a
parallel reset token system.

## Architecture

- `POST /api/account/request-password-reset` accepts an email address, applies
  reset-request rate limits, and calls `auth.api.requestPasswordReset`.
- Better Auth creates a secure reset token in the existing `verification` table
  under `reset-password:<token>`.
- `lib/auth.ts` implements Better Auth's `emailAndPassword.sendResetPassword`
  callback and sends a localized Resend email through
  `lib/account/email-provider.ts`.
- The reset email links to `/reset-password?token=...` on the canonical app
  origin.
- `POST /api/account/reset-password` validates the token and password shape,
  then calls `auth.api.resetPassword`.
- Better Auth consumes the reset token, hashes the new password, and updates the
  credential account.

## Production Origin

Password reset links use the canonical production origin:

```text
https://vestraapp.uk
```

The reset-link builder never trusts the request `Host` header. In production,
the Better Auth trusted origins are restricted to the same canonical HTTPS
origin through `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`.

## Environment

Password reset reuses the same email provider settings as email verification:

```env
BETTER_AUTH_URL="https://vestraapp.uk"
NEXT_PUBLIC_APP_URL="https://vestraapp.uk"
EMAIL_PROVIDER="resend"
EMAIL_FROM="Vestra <noreply@your-domain.com>"
EMAIL_REPLY_TO="support@your-domain.com"
RESEND_API_KEY="<server-only-resend-api-key>"
EMAIL_REQUEST_TIMEOUT_MS="10000"
```

## Security Behavior

- Public reset requests return a neutral success response:
  "If an account exists for this email, we've sent a reset link."
- The route rate-limits by email and IP to reduce reset spam.
- Reset tokens expire after 1 hour.
- Tokens are single-use because Better Auth consumes the verification row during
  `auth.api.resetPassword`.
- Password rules match Better Auth defaults: 8 to 128 characters.
- `revokeSessionsOnPasswordReset` is enabled, so Better Auth invalidates active
  sessions for the user after a successful password reset.
- Logs never include reset tokens, passwords, Authorization headers, full reset
  URLs, or email bodies.

## Stable Error Codes

- `password_reset_rate_limited`
- `password_reset_email_delivery_failed`
- `password_reset_invalid_token`
- `password_reset_expired_token`
- `password_reset_token_used`
- `password_reset_invalid_password`
- `password_reset_failed`

## Manual Production Test

1. Confirm Vercel env vars use `https://vestraapp.uk` for `BETTER_AUTH_URL` and
   `NEXT_PUBLIC_APP_URL`.
2. Confirm Resend `EMAIL_FROM` sender/domain is verified.
3. Open `/forgot-password`.
4. Submit an existing account email and confirm the neutral success message.
5. Confirm the email arrives and the link starts with
   `https://vestraapp.uk/reset-password`.
6. Open the link and set a new password.
7. Confirm the success state links back to sign in.
8. Confirm the old password no longer signs in.
9. Confirm the new password signs in.
10. Reopen the same reset link and confirm it returns an invalid/used-token
    state.
11. Submit an unknown email and confirm the same neutral public success message.
