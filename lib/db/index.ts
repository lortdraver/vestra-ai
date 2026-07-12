import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getDatabaseUrl } from '@/lib/env'
import * as schema from './schema'

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export const db = drizzle(pool, { schema })
