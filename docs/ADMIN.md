# Admin

Milestone 5.5 introduces the Vestra admin foundation.

## Access

The admin dashboard lives at `/dashboard/admin`.

Only users with `admin` or `moderator` role can access the route. Unauthorized users receive a 404 response.

## Dashboard Sections

Implemented admin views:

- user count
- premium user count
- trial user count
- active subscription count
- recent users list
- user roles
- subscription status
- wardrobe item count
- outfit count
- AI usage count
- system status
- security events
- audit events

## Future Store Architecture

The admin panel reserves space for:

- local store catalogs
- second-hand catalogs
- trend database
- partner management

These are architecture placeholders only. No store business logic is implemented yet.
