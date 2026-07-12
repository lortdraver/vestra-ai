# Security

Milestone 5.5 adds the first production security foundation for Vestra.

## Authentication Protection

- Better Auth remains the authentication system.
- Middleware applies development-safe rate limits to auth routes.
- Auth UI maps common failures to localized messages: invalid email, wrong password, account not found, existing account, and too many attempts.
- Password reset and email verification are represented with production-ready token/email abstractions. Real email delivery is intentionally not faked.

## Roles and Permissions

Roles are defined in `lib/roles`:

- `user`
- `moderator`
- `admin`

Admin routes check the database-backed role before rendering protected content.

## Audit and Security Events

The database schema now includes:

- `audit_log`
- `security_event`
- `account_recovery_token`
- `email_verification_request`

Use `safeAuditLog` and `safeSecurityEvent` for development-safe logging that does not crash user flows.

## Request Limits

Middleware rate limits:

- `/api/auth/*`
- `/api/stylist/*`
- `/api/wardrobe/items/*`
- `/dashboard/admin/*`

The current implementation is in-memory and suitable for local development. Production should replace it with Redis, Upstash, or another distributed store before public launch.

## Upload Safety

Existing wardrobe upload validation remains active:

- MIME validation
- file size limits
- image compression before upload
- secure storage abstraction
