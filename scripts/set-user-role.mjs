import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { canonicalRoles } from '../lib/roles/constants.js'

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

function buildSummary({ userExists, currentRole, targetRole, apply, changed }) {
  return {
    userExists,
    currentRole: userExists ? normalizeRole(currentRole) : null,
    targetRole,
    dryRun: !apply,
    applyRequested: apply,
    willChange:
      Boolean(userExists) &&
      Boolean(targetRole) &&
      normalizeRole(currentRole) !== targetRole,
    changed,
  }
}

function print(result) {
  console.log(JSON.stringify(result, null, 2))
}

loadEnv()

const emailInput = getArg('--email')
const targetRole = getArg('--role')
const apply = hasFlag('--apply')

if (!emailInput || !targetRole) {
  console.error(
    'Usage: pnpm user:role -- --email=user@example.com --role=user|moderator|admin [--apply]',
  )
  process.exit(1)
}

if (!canonicalRoles.includes(targetRole)) {
  print({
    ok: false,
    code: 'invalid_role',
    summary: buildSummary({
      userExists: false,
      currentRole: null,
      targetRole: null,
      apply,
      changed: false,
    }),
  })
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. No role change was executed.')
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
      summary: buildSummary({
        userExists: false,
        currentRole: null,
        targetRole,
        apply,
        changed: false,
      }),
    })
    process.exit(1)
  }

  const currentRole = normalizeRole(currentUser.role)

  if (!apply) {
    print({
      ok: true,
      code: 'dry_run',
      summary: buildSummary({
        userExists: true,
        currentRole,
        targetRole,
        apply,
        changed: false,
      }),
    })
    process.exit(0)
  }

  if (currentRole === targetRole) {
    print({
      ok: true,
      code: 'noop',
      summary: buildSummary({
        userExists: true,
        currentRole,
        targetRole,
        apply,
        changed: false,
      }),
    })
    process.exit(0)
  }

  await client.query('update "user" set "role" = $1 where id = $2', [
    targetRole,
    currentUser.id,
  ])

  print({
    ok: true,
    code: 'updated',
    summary: buildSummary({
      userExists: true,
      currentRole,
      targetRole,
      apply,
      changed: true,
    }),
  })
} finally {
  await client.end().catch(() => undefined)
}
