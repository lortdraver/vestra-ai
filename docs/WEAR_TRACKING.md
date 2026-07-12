# Wear Tracking and Wardrobe Insights

Milestone 6.1 adds in-app wear history and wardrobe usage insights. It does not
add weather, calendar, shopping, money-saved counters, notifications, or
scheduled jobs.

## Schema

Migration: `drizzle/0008_wear_tracking_insights.sql`

Tables:

- `wear_log`: `id`, `userId`, `outfitId`, `wornAt`, `source`, `note`,
  `idempotencyKey`, `timezone`, `createdAt`, `updatedAt`.
- `wear_log_item`: `wearLogId`, `wardrobeItemId`, `role`, `createdAt`.

Indexes:

- `wear_log_user_worn_at_idx` supports user-scoped date history and pagination.
- `wear_log_user_outfit_idx` supports outfit filtering.
- `wear_log_user_idempotency_idx` is a partial unique index for duplicate-click
  protection when an idempotency key is supplied.
- `wear_log_item_wear_log_idx` supports loading item rows for a log.
- `wear_log_item_wardrobe_item_idx` supports item filtering and aggregates.

Foreign keys:

- `wear_log.userId` references `user.id` with cascade delete.
- `wear_log.outfitId` references `outfit.id` with set-null delete behavior.
- `wear_log_item.wearLogId` references `wear_log.id` with cascade delete.
- `wear_log_item.wardrobeItemId` references `wardrobe_item.id` with cascade
  delete.

## API

Create one item wear:

```json
POST /api/wear-logs
{
  "wardrobeItemId": "item-id",
  "wornAt": "2026-07-11T08:00:00.000Z",
  "timezone": "Asia/Baku",
  "note": "Optional note",
  "idempotencyKey": "client-action-key"
}
```

Create multiple items:

```json
POST /api/wear-logs
{
  "wardrobeItemIds": ["top-id", "bottom-id", "shoe-id"],
  "timezone": "Asia/Baku",
  "idempotencyKey": "client-action-key"
}
```

Create from an outfit:

```json
POST /api/wear-logs
{
  "outfitId": "outfit-id",
  "timezone": "Asia/Baku",
  "idempotencyKey": "client-action-key"
}
```

List logs:

```text
GET /api/wear-logs?limit=20&offset=0&startDate=2026-07-01T00:00:00.000Z&endDate=2026-07-31T23:59:59.999Z&itemId=item-id&outfitId=outfit-id
```

Undo/delete:

```text
DELETE /api/wear-logs/:id
```

Insights:

```text
GET /api/wardrobe/insights?range=30
GET /api/wardrobe/insights?range=60
GET /api/wardrobe/insights?range=90
GET /api/wardrobe/insights?range=all
```

## Utilization

```text
unique active wardrobe items worn during selected period
/
total active wardrobe items
* 100
```

Deleted or pending-deletion items are excluded from active wardrobe totals.

One outfit wear creates one `wear_log` activity record. Each included item also
gets one `wear_log_item` row, so item-level wear counts increase once per
included item.

## Timezone Strategy

The browser sends the user's IANA timezone, such as `Asia/Baku`, with each wear
request. The server stores the exact `wornAt` instant and the timezone used for
the action. UI display is localized in the browser. Invalid or missing
timezones fall back to `UTC`.

For "today", the client creates the timestamp from the browser's local date
instead of relying on the server's UTC calendar day.

## Security

Every API route requires authentication. The server validates:

- every wardrobe item belongs to the authenticated user;
- every item has `imageDeletionStatus = active`;
- the outfit belongs to the authenticated user;
- outfit items resolve to active owned wardrobe items;
- empty item lists are rejected;
- repeated item IDs are deduplicated;
- deletes are scoped by `userId`;
- `wear_log` plus `wear_log_item` inserts happen in a transaction.

Duplicate-click protection uses a per-user partial unique idempotency index. If
the same key is reused, the existing log is returned instead of creating a
second record.

## Manual Test Plan

1. Apply migrations with `pnpm db:apply`.
2. Sign in and open `/dashboard/wardrobe`.
3. Click `I wore this` on a wardrobe card and confirm the wear count updates.
4. Open item details, choose a historical date, add a note, and record wear.
5. Use `Undo` and confirm the latest wear disappears.
6. Open `/dashboard/outfits` and mark a saved outfit as worn.
7. Generate an outfit in `/dashboard/stylist` and mark it as worn.
8. Change insights range between 30, 60, 90, and all time.
9. Confirm utilization, never-worn items, long-unused items, recent activity,
   and category usage update without exposing another user's data.

## Known Limitations

- Long-unused suggestions are in-app only.
- Dismissed suggestions are temporary client state for this milestone.
- There are no scheduled reminders, push notifications, or email nudges.
- There is no money-saved counter in M6.1.
