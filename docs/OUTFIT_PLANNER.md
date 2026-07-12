# Outfit Planner

Milestone 6.3 introduces Vestra's internal weather-aware outfit planner.

## Database

The planner uses `outfit_plan` with user-scoped rows, nullable outfit and generation batch links, date range fields, all-day support, location fields, status, source, and metadata.

Statuses:

- `planned`
- `worn`
- `skipped`

Sources:

- `manual`
- `stylist`
- `weather_suggestion`
- `calendar_import`

## API

```http
POST /api/outfit-plans
GET /api/outfit-plans?startDate=2026-07-12T00:00:00.000Z&endDate=2026-07-19T00:00:00.000Z
GET /api/outfit-plans/:id
PATCH /api/outfit-plans/:id
DELETE /api/outfit-plans/:id
```

All routes require authentication and only return plans owned by the current user.

## Security

When a plan references an outfit or generation batch, Vestra verifies ownership. Outfit plans reject foreign outfits, unavailable generation batches, deleted wardrobe items, and hallucinated item references. Marking a plan as worn uses M6.1 wear logging with an idempotency key of `plan:{id}` to prevent duplicate wear logs.

## Weather-Aware Recommendations

The stylist request can include weather context. Before provider generation, Vestra applies deterministic suitability rules for hot, mild, cold, rain, snow, strong wind, high UV, and large temperature swings.

The stylist still receives only authenticated, owned, active wardrobe items.

## UI

The planner page includes today's recommendation view, manual city entry, browser geolocation after user action, weather-aware candidates, planning for today, a 7-day list, and worn/skipped actions.

## Manual Testing

1. Set `WEATHER_PROVIDER=mock` in development.
2. Sign in.
3. Add a complete wardrobe with top, bottoms, and shoes.
4. Open `/dashboard/planner`.
5. Generate today's outfit.
6. Save one candidate as today's plan.
7. Mark the plan worn and verify repeated clicks do not create duplicate wear logs.
