import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

function detectEnv(value) {
  const normalized = String(value ?? '').toLowerCase()
  if (!normalized) return null
  if (
    normalized.includes('sandbox') ||
    normalized.includes('sdbx') ||
    normalized.includes('test_') ||
    normalized.includes('_test') ||
    normalized.includes('client_test') ||
    normalized.includes('pri_test')
  ) {
    return 'sandbox'
  }
  if (
    normalized.includes('live') ||
    normalized.includes('production') ||
    normalized.includes('prod_') ||
    normalized.includes('_prod')
  ) {
    return 'live'
  }
  return null
}

function urlCheck(name, value, { requireHttps }) {
  try {
    const url = new URL(value)
    const localhost = ['localhost', '127.0.0.1'].includes(url.hostname)
    return {
      ok: (!requireHttps || url.protocol === 'https:') && !localhost,
      host: url.host,
      protocol: url.protocol,
      localhost,
    }
  } catch {
    return { ok: false, host: null, protocol: null, localhost: false, name }
  }
}

function fileRouteExists(routePath) {
  const appPath =
    routePath === '/' ? 'app/page.tsx' : `app${routePath}/page.tsx`
  return existsSync(resolve(process.cwd(), appPath))
}

function routeHandlerExists(routePath) {
  return existsSync(resolve(process.cwd(), `app${routePath}/route.ts`))
}

function addCheck(checks, name, ok, details = {}) {
  checks.push({ name, ok: Boolean(ok), ...details })
}

loadEnv()

const checks = []
const environment = process.env.PADDLE_ENVIRONMENT
const expectedHost =
  environment === 'live' ? 'api.paddle.com' : 'sandbox-api.paddle.com'
const apiBaseUrl =
  process.env.PADDLE_API_BASE_URL ||
  (environment === 'live'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com')

addCheck(
  checks,
  'paddle_environment_valid',
  ['sandbox', 'live'].includes(environment),
  {
    environment: environment ?? null,
  },
)

for (const name of [
  'PADDLE_API_KEY',
  'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
  'PADDLE_WEBHOOK_SECRET',
  'PADDLE_PRO_MONTHLY_PRICE_ID',
  'PADDLE_PRO_ANNUAL_PRICE_ID',
]) {
  addCheck(checks, `${name.toLowerCase()}_present`, Boolean(process.env[name]))
}

for (const name of [
  'PADDLE_API_KEY',
  'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
  'PADDLE_WEBHOOK_SECRET',
  'PADDLE_PRO_MONTHLY_PRICE_ID',
  'PADDLE_PRO_ANNUAL_PRICE_ID',
]) {
  const detected = detectEnv(process.env[name])
  addCheck(
    checks,
    `${name.toLowerCase()}_environment_consistent`,
    !detected || detected === environment,
    { detectedEnvironment: detected },
  )
}

let apiHost = null
try {
  apiHost = new URL(apiBaseUrl).host
} catch {
  apiHost = null
}
addCheck(
  checks,
  'paddle_api_host_matches_environment',
  apiHost === expectedHost,
  {
    apiHost,
    expectedHost,
  },
)

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
const appUrlCheck = urlCheck('app_url', appUrl, {
  requireHttps: environment === 'live',
})
addCheck(
  checks,
  'app_url_https_and_public_for_live',
  appUrlCheck.ok,
  appUrlCheck,
)

addCheck(checks, 'privacy_route_exists', fileRouteExists('/privacy'))
addCheck(checks, 'terms_route_exists', fileRouteExists('/terms'))
addCheck(checks, 'refund_route_exists', fileRouteExists('/refund'))
addCheck(
  checks,
  'paddle_webhook_route_exists',
  routeHandlerExists('/api/webhooks/paddle'),
)
addCheck(
  checks,
  'paddle_checkout_route_exists',
  routeHandlerExists('/api/billing/paddle/checkout'),
)
addCheck(
  checks,
  'privacy_contact_configured',
  Boolean(process.env.PRIVACY_CONTACT_EMAIL || process.env.SUPPORT_EMAIL),
)

const failed = checks.filter((check) => !check.ok)
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      dryRun: true,
      mutation: false,
      configuredEnvironment: environment ?? null,
      checks,
    },
    null,
    2,
  ),
)

if (failed.length > 0) process.exit(1)
