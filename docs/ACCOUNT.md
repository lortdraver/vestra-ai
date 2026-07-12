# Account

Milestone 5.5 adds the account system foundation.

## Profile Page

The account page lives at `/dashboard/account` and shows:

- avatar placeholder
- name
- email
- registration date
- current plan
- trial status
- wardrobe item count
- saved outfit count
- AI usage statistics

## Account Actions

Implemented actions:

- edit profile placeholder
- change language access
- Better Auth logout
- account deletion placeholder with cascade preparation copy

## Security Foundation

Implemented architecture:

- forgot password page
- reset password page
- recovery token hashing
- token expiry helpers
- email provider abstraction
- manual development email provider
- email verification request table

Real email sending is intentionally not connected yet.
