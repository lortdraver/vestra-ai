import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

loadEnv()

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL')
}

const migrationFiles = readdirSync(resolve(process.cwd(), 'drizzle'))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort()

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
})

const client = await pool.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT now()
    )
  `)

  const appliedResult = await client.query(
    'SELECT name FROM public.app_schema_migrations',
  )
  const applied = new Set(appliedResult.rows.map((row) => row.name))

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      console.log(`Skipping ${file}`)
      continue
    }

    console.log(`Applying ${file}`)
    await client.query('BEGIN')
    try {
      const sql = readFileSync(resolve(process.cwd(), 'drizzle', file), 'utf8')
      await client.query(sql)
      await client.query(
        'INSERT INTO public.app_schema_migrations (name) VALUES ($1)',
        [file],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }

  console.log('Database SQL migrations are up to date.')
} finally {
  client.release()
  await pool.end()
}
