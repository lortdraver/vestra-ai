# Architecture

## Principle

Vestra starts as a production monolith. The app uses Next.js route handlers and server components for the web product while keeping clear module boundaries for auth, database, i18n, UI, and future domain logic.

## Current Structure

- `app/` - App Router pages, layouts, and API route handlers.
- `components/` - shared UI and app shell components.
- `components/ui/` - shadcn/ui primitives.
- `lib/auth.ts` - Better Auth server configuration.
- `lib/auth-client.ts` - browser auth client.
- `lib/db/` - Drizzle client and schema.
- `lib/i18n/` - locale config, dictionaries, and server locale resolution.
- `lib/storage/` - object storage abstraction and development adapter.
- `lib/wardrobe/` - wardrobe constants, validation, serialization, and image compression.
- `lib/ai/` - AI provider abstraction, Zod schemas, mock provider, and production provider adapter.
- `docs/` - project and operational documentation.
- `__tests__/` - foundation tests.

## Milestone 1 Scope

Milestone 2 adds the wardrobe core while preserving the monolith and module boundaries established in Milestone 1.

## Scaling Notes

- Neon PostgreSQL remains the source of truth.
- Every user-owned table must include `userId` and all queries must scope by `userId`.
- Drizzle is used for typed SQL and schema evolution.
- Better Auth owns session and password authentication.
- Expensive AI endpoints should later add rate limits before public launch.
- User-facing strings must live in dictionaries, not inline components.
- Images are accessed through storage metadata and cleanup queues, not ad hoc file paths in feature code.
- AI output is validated with Zod and stored separately from user corrections.
