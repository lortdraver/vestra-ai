import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { canonicalRoles } from '../lib/roles/constants.js'

const internalOverrideProviderKey = 'internal_override'

function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const envPath = resolve(process.cwd(), filename)
    if (!existsSync(envPath)) continue

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2]
      }
    }
  }
}

function getArg(name) {
  const prefix = `${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function normalizeRole(role) {
  return canonicalRoles.includes(role) ? role : 'user'
}

function getAction() {
  const action = getArg('--action')
  if (action === 'grant_pro' || action === 'revoke') return action
  if (hasFlag('--grant-pro')) return 'grant_pro'
  if (hasFlag('--revoke')) return 'revoke'

  return null
}

function print(result) {
  console.log(JSON.stringify(result, null, 2))
}

function summary({
  userExists,
  currentRole,
  action,
  activeOverride,
  apply,
  changed,
  paddleSubscriptionCount,
}) {
  return {
    userExists,
    currentRole: userExists ? normalizeRole(currentRole) : null,
    targetPlan:
      action === 'grant_pro' ? 'premium' : action === 'revoke' ? 'free' : null,
    source: action ? internalOverrideProviderKey : null,
    activeOverride,
    dryRun: !apply,
    applyRequested: apply,
    willChange:
      userExists &&
      Boolean(action) &&
      ((action === 'grant_pro' && !activeOverride) ||
        (action === 'revoke' && activeOverride)),
    changed,
    paddleSubscriptionCount,
  }
}

loadEnv()

const emailInput = getArg('--email')
const action = getAction()
const apply = hasFlag('--apply')

if (!emailInput || !action) {
  console.error(
    'Usage: pnpm subscription:override -- --email=user@example.com --grant-pro|--revoke [--apply]',
  )
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. No subscription override was executed.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()

  const normalizedEmail = normalizeEmail(emailInput)
  const userResult = await client.query(
    'select id, role from "user" where lower(email) = $1 limit 1',
    [normalizedEmail],
  )
  const currentUser = userResult.rows[0]

  if (!currentUser?.id) {
    print({
      ok: false,
      code: 'unknown_user',
      summary: summary({
        userExists: false,
        currentRole: null,
        action,
        activeOverride: false,
        apply,
        changed: false,
        paddleSubscriptionCount: 0,
      }),
    })
    process.exit(1)
  }

  const currentRole = normalizeRole(currentUser.role)
  const stateResult = await client.query(
    `select
       count(*) filter (where "providerKey" = $2 and status = 'active' and "planKey" = 'premium')::int as "activeOverrideCount",
       bool_or("providerKey" = $2 and "providerCustomerId" is not null) as "providerCustomerIdPresent",
       bool_or("providerKey" = $2 and "providerSubscriptionId" is not null) as "providerSubscriptionIdPresent",
       count(*) filter (where "providerKey" = 'paddle')::int as "paddleSubscriptionCount"
     from "subscription"
     where "userId" = $1`,
    [currentUser.id, internalOverrideProviderKey],
  )
  const state = stateResult.rows[0] ?? {}
  const activeOverride = Number(state.activeOverrideCount ?? 0) > 0
  const paddleSubscriptionCount = Number(state.paddleSubscriptionCount ?? 0)

  if (currentRole !== 'admin') {
    print({
      ok: false,
      code: 'target_not_admin',
      summary: summary({
        userExists: true,
        currentRole,
        action,
        activeOverride,
        apply,
        changed: false,
        paddleSubscriptionCount,
      }),
    })
    process.exit(1)
  }

  if (
    Boolean(state.providerCustomerIdPresent) ||
    Boolean(state.providerSubscriptionIdPresent)
  ) {
    print({
      ok: false,
      code: 'unsafe_override_state',
      summary: summary({
        userExists: true,
        currentRole,
        action,
        activeOverride,
        apply,
        changed: false,
        paddleSubscriptionCount,
      }),
    })
    process.exit(1)
  }

  if (!apply) {
    print({
      ok: true,
      code: 'dry_run',
      summary: summary({
        userExists: true,
        currentRole,
        action,
        activeOverride,
        apply,
        changed: false,
        paddleSubscriptionCount,
      }),
    })
    process.exit(0)
  }

  if (action === 'grant_pro') {
    if (activeOverride) {
      print({
        ok: true,
        code: 'noop',
        summary: summary({
          userExists: true,
          currentRole,
          action,
          activeOverride,
          apply,
          changed: false,
          paddleSubscriptionCount,
        }),
      })
      process.exit(0)
    }

    await client.query(
      `insert into "subscription" (
        "userId", "planKey", status, "providerKey", metadata, "createdAt", "updatedAt"
       ) values (
        $1, 'premium', 'active', $2, $3::jsonb, now(), now()
       )`,
      [
        currentUser.id,
        internalOverrideProviderKey,
        JSON.stringify({
          source: internalOverrideProviderKey,
          grantedAt: new Date().toISOString(),
          reason: 'owner_development_testing',
        }),
      ],
    )

    print({
      ok: true,
      code: 'granted',
      summary: summary({
        userExists: true,
        currentRole,
        action,
        activeOverride,
        apply,
        changed: true,
        paddleSubscriptionCount,
      }),
    })
    process.exit(0)
  }

  if (!activeOverride) {
    print({
      ok: true,
      code: 'noop',
      summary: summary({
        userExists: true,
        currentRole,
        action,
        activeOverride,
        apply,
        changed: false,
        paddleSubscriptionCount,
      }),
    })
    process.exit(0)
  }

  await client.query(
    `update "subscription"
     set status = 'inactive',
       metadata = metadata || $3::jsonb,
       "updatedAt" = now()
     where "userId" = $1
       and "providerKey" = $2
       and status = 'active'`,
    [
      currentUser.id,
      internalOverrideProviderKey,
      JSON.stringify({ revokedAt: new Date().toISOString() }),
    ],
  )

  print({
    ok: true,
    code: 'revoked',
    summary: summary({
      userExists: true,
      currentRole,
      action,
      activeOverride,
      apply,
      changed: true,
      paddleSubscriptionCount,
    }),
  })
} finally {
  await client.end().catch(() => undefined)
}
