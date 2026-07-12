import { defineConfig } from 'drizzle-kit'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDatabaseUrl } from './lib/env'

function loadLocalEnv() {
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

loadLocalEnv()

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  strict: true,
  verbose: true,
})
