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

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

function evaluate(row) {
  if (!row) return { entitled: false, reason: 'free', graceUntil: null }
  const now = new Date()
  if (row.status === 'active' || row.status === 'trialing') {
    if (
      row.cancelAtPeriodEnd &&
      row.currentPeriodEnd &&
      new Date(row.currentPeriodEnd) <= now
    ) {
      return { entitled: false, reason: 'canceled', graceUntil: null }
    }
    return {
      entitled: true,
      reason: row.cancelAtPeriodEnd ? 'canceling_until_period_end' : row.status,
      graceUntil: null,
    }
  }
  if (row.status === 'past_due') {
    const graceDays = Number(process.env.PADDLE_PAST_DUE_GRACE_DAYS ?? 3)
    const graceUntil = addDays(
      new Date(row.lastProviderEventAt ?? row.updatedAt),
      graceDays,
    )
    return {
      entitled: graceUntil > now,
      reason: graceUntil > now ? 'past_due_grace' : 'free',
      graceUntil,
    }
  }
  return { entitled: false, reason: row.status ?? 'inactive', graceUntil: null }
}

function configuredEnvironment() {
  return process.env.PADDLE_ENVIRONMENT || 'missing'
}

function rowEnvironment(row) {
  const value = row?.metadata?.paddleEnvironment
  return value === 'sandbox' || value === 'live' ? value : null
}

function shorten(value) {
  return value ? `${String(value).slice(0, 8)}...` : null
}

loadEnv()

const email = getArg('--email')
if (!email) {
  console.error('Usage: pnpm billing:diagnose -- --email=user@example.com')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. No diagnostic query was executed.')
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
  const subscriptionResult = currentUser?.id
    ? await client.query(
        'select * from "subscription" where "userId" = $1 order by "updatedAt" desc limit 1',
        [currentUser.id],
      )
    : { rows: [] }
  const row = subscriptionResult.rows[0]
  const entitlement = evaluate(row)
  const paddleEnvironment = rowEnvironment(row)

  console.log(
    JSON.stringify(
      {
        userExists: Boolean(currentUser),
        plan: row?.planKey ?? 'free',
        billingInterval: row?.billingInterval ?? null,
        internalStatus: row?.status ?? 'inactive',
        cancelAtPeriodEnd: Boolean(row?.cancelAtPeriodEnd),
        currentPeriodEnd: row?.currentPeriodEnd ?? null,
        providerMappingPresent: Boolean(
          row?.providerCustomerId && row?.providerSubscriptionId,
        ),
        configuredPaddleEnvironment: configuredEnvironment(),
        providerMappingEnvironment: paddleEnvironment,
        providerMappingMatchesEnvironment:
          !row || paddleEnvironment === configuredEnvironment(),
        providerCustomerId: shorten(row?.providerCustomerId),
        providerSubscriptionId: shorten(row?.providerSubscriptionId),
        paymentIssueState: row?.status === 'past_due',
        currentEntitlement: entitlement.entitled ? 'pro' : 'free',
        entitlementReason: entitlement.reason,
        graceUntil: entitlement.graceUntil,
      },
      null,
      2,
    ),
  )
} finally {
  await client.end().catch(() => undefined)
}
