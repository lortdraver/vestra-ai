-- Safe legacy-user policy for production email verification.
--
-- Vestra already had an emailVerified column before email verification was
-- enforced. Existing credential users may therefore have false simply because
-- verification was not required yet. Mark current credential users verified so
-- the rollout does not lock out active accounts. New users created after this
-- migration are handled by Better Auth's email verification flow.

UPDATE "user"
SET "emailVerified" = true
WHERE "emailVerified" = false
  AND EXISTS (
    SELECT 1
    FROM "account"
    WHERE "account"."userId" = "user"."id"
      AND "account"."providerId" = 'credential'
  );
