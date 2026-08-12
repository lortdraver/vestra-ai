# Privacy And Consent

Phase 1 created the privacy and consent foundation. Phase 2 adds minimized,
server-side first-party product events; it does not implement GA4, Microsoft
Clarity, partner dashboards, advertising, or a public analytics dashboard.

## Consent Categories

Vestra currently uses two consent categories:

- Necessary: always enabled. Required for authentication, security, sessions,
  language, email verification, password reset, account protection, and private
  image access.
- Analytics: optional. Reserved for Vercel Analytics now and future GA4,
  Microsoft Clarity, and first-party client analytics.

The model is intentionally extensible so a future Marketing category can be
added without replacing the consent system.

## Cookie Design

Consent is stored in a first-party cookie:

- name: `vestra_consent`
- path: `/`
- SameSite: `Lax`
- Secure: enabled on HTTPS / production
- lifetime: 365 days
- policy version: `2026-08-12`
- schema version: `1`

The cookie stores only:

```json
{
  "version": 1,
  "necessary": true,
  "analytics": true,
  "timestamp": "2026-08-12T00:00:00.000Z",
  "policyVersion": "2026-08-12"
}
```

It must never store email, user id, Better Auth session id, IP address,
fingerprints, or other personally identifiable information.

## Lifecycle

Users without a valid consent decision see a compact banner with equal access to
Accept analytics, Reject analytics, and Manage preferences.

Users can change their choice later through:

- the global Cookie preferences control;
- the authenticated account avatar menu;
- the public Privacy Policy page.

If `version` or `policyVersion` changes, the saved decision is treated as stale
and Vestra asks again.

## Vercel Analytics

Vercel Analytics is classified as optional analytics. It is not loaded
unconditionally. The root layout passes the server-read consent state into the
client consent manager, and `@vercel/analytics/next` is rendered only when
Analytics consent is present.

Future GA4 and Microsoft Clarity loaders must follow the same rule:

```ts
import { hasAnalyticsConsent } from '@/lib/privacy/consent'
```

Vestra's first-party product analytics are separate from optional browser
analytics. They are collected server-side for product operation, security,
reliability, and aggregate improvement, so they do not require the optional
Analytics cookie. They never include emails, tokens, raw prompts or responses,
private notes, image URLs/storage keys, or raw photos. They are not used for
advertising without a future consent and policy review.

Client loaders should use the browser consent helper and must not load tags
before Analytics is allowed.

## Privacy Policy

The public route `/privacy` is available without authentication and localized in
Azerbaijani, English, and Russian.

The initial release includes the cookie policy inside the Privacy Policy rather
than creating a separate `/cookies` page. This keeps the launch surface simple
while still documenting necessary and analytics cookies clearly.

## Privacy Rules

Never expose to analytics:

- emails
- passwords
- authentication/session tokens
- verification/reset tokens
- wardrobe image URLs
- R2 storage keys
- raw wardrobe photos
- private notes
- raw AI prompts
- AI response bodies
- exact sensitive free-text input

Partner or brand insights must be aggregate-only and thresholded. They must not
expose individual users.

## Environment

Optional:

```env
PRIVACY_CONTACT_EMAIL="privacy@example.com"
```

If unset, the Privacy Policy displays a configuration placeholder instead of
inventing a legal entity, address, phone number, DPO, or contact.
