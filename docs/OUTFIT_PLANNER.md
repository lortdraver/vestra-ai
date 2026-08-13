# Outfit Planner

Vestra's planner is the calendar layer that turns wardrobe items, saved
outfits, weather, and wear history into daily outfit decisions.

## Data Model

The planner uses the existing `outfit_plan` table. No dedicated weather table is
required for v1 because `outfit_plan.metadata` stores structured planner
metadata:

- `weatherSnapshot`: normalized weather at the time an outfit was scheduled;
- `weatherChange`: later forecast-change assessment;
- `weatherSuitability`: suitability level and message;
- `wornLoggedAt`: timestamp set after a plan is marked worn.

Planner rows remain user-scoped. Referenced outfits and generation batches are
validated before a plan is created or changed.

Statuses:

- `planned`
- `worn`
- `skipped`

Sources:

- `manual`
- `stylist`
- `weather_suggestion`
- `calendar_import`

Occasions are canonical and localized in the UI:

- `everyday`
- `university`
- `work`
- `business`
- `date`
- `dinner`
- `party`
- `sport`
- `travel`
- `outdoor`
- `formal_event`

## API

```http
POST /api/outfit-plans
GET /api/outfit-plans?startDate=2026-07-12T00:00:00.000Z&endDate=2026-07-19T00:00:00.000Z
GET /api/outfit-plans/:id
PATCH /api/outfit-plans/:id
DELETE /api/outfit-plans/:id
```

All routes require authentication and only return plans owned by the current
user.

## Weather Flow

The planner loads weather through the authenticated server route:

```http
GET /api/weather?locationName=Baku
GET /api/weather?latitude=40.4093&longitude=49.8671
```

The browser never calls an external weather provider directly and never sees
weather credentials.

The UI supports:

- manual city entry;
- optional geolocation after a user click;
- month calendar with weather summaries;
- selected-day detail panel;
- weather-aware outfit generation;
- choosing saved outfits with suitability warnings;
- forecast-change warnings after an outfit was scheduled.

## Stylist Integration

Planner generation sends a normalized `weatherContext` to the existing stylist
route. The stylist continues to receive only authenticated, owned, active
wardrobe items. Before the provider call, deterministic weather filtering and
ranking consider season, rain, snow, heat, cold, wind, and recently worn items.

Vestra does not invent weather-proofing. If no rain-ready wardrobe pieces are
known, the UI shows a warning instead of claiming the outfit is waterproof.

## Saved Outfits

Users can select an existing saved outfit for a day. Vestra evaluates the outfit
against the selected day's forecast. If the saved outfit looks too warm, too
light, or weak for rain/snow, the plan can still be scheduled, but the warning
is stored in metadata and shown in the UI.

## Mark As Worn

Changing a plan to `worn` creates a wear log through the M6.1 wear service with
idempotency key `plan:{planId}`. Repeated clicks do not create duplicate wear
logs. Historical wear statistics remain independent from planner edits.

## Analytics

The planner emits privacy-safe first-party analytics events:

- `planner_weather_loaded`
- `planner_weather_failed`
- `planner_outfit_generated`
- `planner_outfit_scheduled`
- `planner_outfit_changed`
- `planner_weather_change_detected`
- `planner_outfit_adapted`
- `planner_outfit_marked_worn`
- `planner_outfit_deleted`

Events do not contain exact addresses, image URLs, storage keys, prompts,
private notes, or outfit contents.

## Failure Behavior

Weather failures do not block manual planning or saved-outfit selection. The UI
shows a localized warning and keeps the planner usable. If a weather-aware
stylist request fails, users can retry or schedule an existing saved outfit.

## Manual Testing

1. Configure weather mode. For production-like local testing use:

   ```env
   WEATHER_PROVIDER="open_meteo"
   WEATHER_API_BASE_URL="https://api.open-meteo.com/v1"
   WEATHER_GEOCODING_API_BASE_URL="https://geocoding-api.open-meteo.com/v1"
   WEATHER_REQUEST_TIMEOUT_MS="8000"
   WEATHER_CACHE_TTL_SECONDS="900"
   ```

2. Sign in with a verified account.
3. Add a complete wardrobe with a top, bottoms, and shoes.
4. Save at least one stylist outfit.
5. Open `/dashboard/planner`.
6. Change the city and reload weather.
7. Generate weather-aware outfits for a selected day.
8. Schedule one candidate.
9. Change weather data or wait for a materially different forecast and confirm
   the warning appears.
10. Mark the plan worn and verify repeated clicks do not duplicate wear logs.
