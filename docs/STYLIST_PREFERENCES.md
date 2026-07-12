# Stylist Preferences

Milestone 6.2 adds explicit preference learning. Preferences are user-edited
product data, not automatic model training.

## Stored Profile

Table: `stylist_preference_profile`

- `userId`
- `preferredStyles`
- `dislikedStyles`
- `preferredColors`
- `avoidedColors`
- `preferredFormality`
- `preferredFit`
- `preferredWardrobeItemIds`
- `dislikedWardrobeItemIds`
- `createdAt`
- `updatedAt`

The user profile is edited through:

- `GET /api/stylist/preferences`
- `PATCH /api/stylist/preferences`

Future recommendation flows can use this profile to rank owned wardrobe items,
add concise preference context to prompts, avoid explicitly disliked items, and
favor explicitly preferred styles.

## Feedback

Feedback is stored as explicit events in `outfit_feedback`.

M6.2 adds:

- `generationBatchId`
- `reasonTags`

Supported feedback actions include like, dislike, not my style, too formal, too
casual, colors do not work, do not like this item, already wore something
similar recently, good combination, and save as preference.

Feedback is always authenticated and scoped to an outfit owned by the current
user.

## Boundaries

- Vestra does not claim the AI is automatically training itself.
- Wear history is only an optional ranking signal.
- Rarely worn items are not treated as disliked.
- Frequently worn items are not automatically excluded.
