# Vestra First-Party Analytics

Phase 2 adds a server-side product event ledger in PostgreSQL. It does not add
GA4, Microsoft Clarity, advertising pixels, partner dashboards, or a public
analytics page. The optional browser analytics consent from Phase 1 remains
only for optional external/browser analytics.

## Architecture

Authoritative product events are written by `trackServerEvent` in
`lib/analytics/server.ts` after the related database operation succeeds (or at
the explicit failure boundary). Writes are best effort: an analytics database
failure is logged safely in development and never changes a product response.

The `analytics_event` table is intentionally not foreign-keyed to `user` or
product entities. This keeps account deletion and operational cleanup from
being blocked by historical analytics rows. Events carry internal identifiers
only where needed for product metrics; they are not exposed to partners.

## Event taxonomy

Implemented authoritative events cover wardrobe creation/deletion, background
removal, AI analysis, stylist requests/results/failures, saved outfit and
feedback actions, planner scheduling/deletion, wear logging, and password
reset completion. The canonical names are in `lib/analytics/events.ts`.

Signup completion, login completion, email verification completion, and
subscription lifecycle names are reserved in the taxonomy but deferred until
the installed Better Auth/payment flows expose reliable success hooks. No
events are fabricated from UI placeholders.

## Privacy rules

Analytics properties are limited to bounded scalars and scalar arrays. The
sanitizer rejects keys associated with email, passwords, tokens, prompts,
responses, notes, images, storage keys, secrets, cookies, and private data.
Never add raw user text, image URLs, provider prompts/responses, or credentials
to an event. Paths are reduced to a pathname and a literal `?query` marker.

First-party operational metrics do not require the optional Analytics cookie;
they are collected server-side to operate, secure, and improve Vestra. They
are not used for advertising or sold as individual-user data. Any future
partner insight must be aggregated and privacy-reviewed.

## Metrics and definitions

`countEventsByRange`, `countActiveUsersByRange`,
`getDailyActiveUsers`/`getWeeklyActiveUsers`/`getMonthlyActiveUsers`,
`countActivatedUsers`, `getProductMetrics`, and `getRetentionCounts` are
read-only helpers for a future admin surface.

- DAU, WAU, and MAU are distinct authenticated `userId` values with at least
  one meaningful product event in the respective UTC day/7-day/30-day window.
- Activation is a verified account with at least one successful
  `wardrobe_item_created` event. Until reliable verification-completion hooks
  are available, the user table's current `emailVerified` value is the
  verification source of truth.
- Retention is the percentage of an activation cohort with a meaningful event
  on D1, D7, or D30. Page views do not count as activity.
- Meaningful events include wardrobe changes, analysis, stylist activity,
  outfit/wear activity, planner activity, and account completion actions.

## Migration

Apply the safe, additive migration with:

```text
pnpm db:apply
```

This applies `drizzle/0013_first_party_analytics.sql` through the existing
ordered migration runner. There is no backfill recommendation; historical
product actions cannot be reconstructed safely without storing prohibited
data.
