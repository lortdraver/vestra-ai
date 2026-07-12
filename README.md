# Vestra

AI virtual wardrobe and personal stylist foundation.

Milestone 5 adds subscription architecture: Free/Premium plans, usage limits,
feature flags, trial support, payment provider abstractions, and premium UI.
Real payment processing remains out of scope.

## Stack

- Next.js App Router with React Server Components
- TypeScript in strict mode
- Tailwind CSS v4 and shadcn/ui
- Drizzle ORM on Neon PostgreSQL
- Better Auth with email/password
- Azerbaijani default locale, English and Russian supported
- Vitest, ESLint, and Prettier
- Storage abstraction with guarded local development storage
- AI provider abstraction with Zod-validated clothing analysis
- Background-removal provider abstraction with guarded production credentials
- Stylist provider abstraction with hallucination prevention and outfit validation
- Subscription architecture with Free/Premium plans and provider abstractions

## AI Clothing Analysis

Real clothing analysis uses the OpenAI-compatible vision provider by default.
Set `AI_API_KEY`, `AI_API_BASE_URL`, and `AI_MODEL_ID` in `.env.local`.

Use `AI_PROVIDER=mock` only for tests or explicit local mock mode. Vestra no
longer silently returns mock clothing analysis in the normal app flow.

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env.local` from `.env.example` and fill real values.

3. Apply the committed SQL migrations to the Neon database configured in
   `.env.local`:

```bash
pnpm db:apply
```

The Drizzle config and migration runner load `.env.local` first, then `.env`.
Use `pnpm db:apply` for existing databases because it is non-interactive and
applies the checked-in SQL migrations without prompting to alter auth data.
`pnpm db:push` remains available for schema prototyping, but review its prompts
carefully before using it against a database with real users.

4. Start development:

```bash
pnpm dev
```

## Quality Gates

Run these before every milestone handoff:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Milestone Boundary

Current milestone: M5 Subscription Architecture.

Not included yet:

- real payment processing
- billing webhooks or billing portal
- automatic product limit enforcement
- outfit calendar, laundry, trip packing
