import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const envPath = resolve(process.cwd(), filename)
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  }
}

function getArg(name) {
  const prefix = `${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function apiBaseUrl() {
  return (
    process.env.PADDLE_API_BASE_URL || 'https://sandbox-api.paddle.com'
  ).replace(/\/$/, '')
}

function toDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function firstPriceId(data) {
  return data?.items?.[0]?.price?.id ?? data?.items?.[0]?.price_id ?? null
}

function intervalFor(priceId) {
  if (priceId && priceId === process.env.PADDLE_PRO_MONTHLY_PRICE_ID)
    return 'monthly'
  if (priceId && priceId === process.env.PADDLE_PRO_ANNUAL_PRICE_ID)
    return 'annual'
  return null
}

async function markOrphaned(client, local, reason, apply) {
  if (apply) {
    await client.query(
      `update "subscription"
       set "planKey" = 'free', "status" = 'inactive',
           "currentPeriodStart" = null, "currentPeriodEnd" = null,
           "cancelAtPeriodEnd" = false, "scheduledChangeAction" = null,
           "scheduledChangeAt" = null, "lastProviderEventAt" = now(),
           "metadata" = coalesce("metadata", '{}'::jsonb) || $1::jsonb,
           "updatedAt" = now()
       where id = $2`,
      [
        JSON.stringify({
          reconciliation: {
            reason,
            confirmedAt: new Date().toISOString(),
          },
        }),
        local.id,
      ],
    )
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: !apply,
        userFound: true,
        providerSubscriptionFound: false,
        localSubscriptionStatus: local.status,
        driftDetected: true,
        repaired: Boolean(apply),
        reason,
      },
      null,
      2,
    ),
  )
}

loadEnv()

const email = getArg('--email')
const apply = hasFlag('--apply')
if (!email) {
  console.error(
    'Usage: pnpm billing:reconcile -- --email=user@example.com [--apply]',
  )
  process.exit(1)
}
if (!process.env.DATABASE_URL || !process.env.PADDLE_API_KEY) {
  console.error(
    'Missing DATABASE_URL or PADDLE_API_KEY. No mutation was executed.',
  )
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()
  const userResult = await client.query(
    'select id from "user" where lower(email) = $1 limit 1',
    [email.trim().toLowerCase()],
  )
  const currentUser = userResult.rows[0]
  if (!currentUser?.id) {
    console.log(
      JSON.stringify(
        { ok: false, code: 'unknown_user', userFound: false },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const localResult = await client.query(
    'select * from "subscription" where "userId" = $1 and "providerKey" = $2 order by "updatedAt" desc limit 1',
    [currentUser.id, 'paddle'],
  )
  const local = localResult.rows[0]
  if (!local) {
    console.log(
      JSON.stringify(
        { ok: false, code: 'provider_mapping_missing', userFound: true },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  if (!local.providerSubscriptionId) {
    await markOrphaned(client, local, 'missing_provider_subscription_id', apply)
    return
  }

  const response = await fetch(
    `${apiBaseUrl()}/subscriptions/${encodeURIComponent(local.providerSubscriptionId)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        Accept: 'application/json',
      },
    },
  )
  if (response.status === 404) {
    await markOrphaned(client, local, 'provider_subscription_not_found', apply)
    return
  }

  if (!response.ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          code: 'provider_fetch_failed',
          userFound: true,
          providerStatus: response.status,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const provider = (await response.json()).data
  const priceId = firstPriceId(provider)
  const period = provider.current_billing_period ?? {}
  const scheduled = provider.scheduled_change ?? null
  const normalized = {
    status: provider.status,
    providerCustomerId: provider.customer_id,
    providerPriceId: priceId,
    billingInterval: intervalFor(priceId),
    currentPeriodStart: toDate(period.starts_at),
    currentPeriodEnd: toDate(period.ends_at),
    cancelAtPeriodEnd: scheduled?.action === 'cancel',
    scheduledChangeAction: scheduled?.action ?? null,
    scheduledChangeAt: toDate(scheduled?.effective_at),
    lastProviderEventAt: new Date(provider.updated_at ?? Date.now()),
  }
  const driftDetected = Object.entries(normalized).some(([key, value]) => {
    const localValue = local[key]
    if (value instanceof Date)
      return new Date(localValue ?? 0).getTime() !== value.getTime()
    return localValue !== value
  })

  if (apply && driftDetected) {
    await client.query(
      `update "subscription"
       set "status" = $1, "providerCustomerId" = $2, "providerPriceId" = $3,
           "billingInterval" = $4, "currentPeriodStart" = $5,
           "currentPeriodEnd" = $6, "cancelAtPeriodEnd" = $7,
           "scheduledChangeAction" = $8, "scheduledChangeAt" = $9,
           "lastProviderEventAt" = $10, "updatedAt" = now()
       where id = $11`,
      [
        normalized.status,
        normalized.providerCustomerId,
        normalized.providerPriceId,
        normalized.billingInterval,
        normalized.currentPeriodStart,
        normalized.currentPeriodEnd,
        normalized.cancelAtPeriodEnd,
        normalized.scheduledChangeAction,
        normalized.scheduledChangeAt,
        normalized.lastProviderEventAt,
        local.id,
      ],
    )
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: !apply,
        userFound: true,
        localSubscriptionStatus: local.status,
        providerSubscriptionFound: true,
        providerStatus: provider.status,
        driftDetected,
        repaired: Boolean(apply && driftDetected),
      },
      null,
      2,
    ),
  )
} finally {
  await client.end().catch(() => undefined)
}
