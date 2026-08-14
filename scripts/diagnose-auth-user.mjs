import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

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

function summarize(rows, currentUser) {
  const credentialRows = rows.filter((row) => row.providerId === 'credential')
  const role = currentUser?.role ?? 'user'

  return {
    userExists: Boolean(currentUser),
    emailVerified: currentUser?.emailVerified ?? false,
    role,
    adminAccess: role === 'admin',
    accountRowCount: rows.length,
    credentialAccountCount: credentialRows.length,
    credentialProviderIds: Array.from(
      new Set(credentialRows.map((row) => row.providerId)),
    ),
    credentialPasswordPresent: credentialRows.some(
      (row) => typeof row.password === 'string' && row.password.length > 0,
    ),
    duplicateCredentialAccountDetected: credentialRows.length > 1,
  }
}

loadEnv()

const emailInput = getArg('--email')

if (!emailInput) {
  console.error('Usage: pnpm auth:diagnose-user -- --email=user@example.com')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. No diagnostic query was executed.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()

  const normalizedEmail = emailInput.trim().toLowerCase()
  const userResult = await client.query(
    'select id, "emailVerified", role from "user" where lower(email) = $1 limit 1',
    [normalizedEmail],
  )
  const currentUser = userResult.rows[0]

  let accountRows = []
  if (currentUser?.id) {
    const accountResult = await client.query(
      'select "providerId", password from account where "userId" = $1',
      [currentUser.id],
    )
    accountRows = accountResult.rows
  }

  console.log(JSON.stringify(summarize(accountRows, currentUser), null, 2))
} finally {
  await client.end().catch(() => undefined)
}
