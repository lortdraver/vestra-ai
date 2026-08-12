# Admin

Milestone 5.5 introduces the Vestra admin foundation.

## Access

The admin dashboard lives at `/dashboard/admin`.

Only users with the database-backed `admin` role can access the route.
Unauthorized users receive a 404 response.

`moderator` does not currently have access to `/dashboard/admin`.

Role changes are operational database updates, not environment-variable
allowlists. Use the explicit local command:

```text
pnpm user:role -- --email=user@example.com --role=admin
pnpm user:role -- --email=user@example.com --role=moderator
pnpm user:role -- --email=user@example.com --role=user
```

The command is dry-run by default. Add `--apply` to execute the change.

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
