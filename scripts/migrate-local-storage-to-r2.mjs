import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import {
  getR2Config,
  isR2Configured,
  r2Request,
  sanitizeStorageKey,
} from './r2-client.mjs'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function getArg(name) {
  const prefix = `--${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
}

function contentTypeForKey(storageKey, fallback) {
  if (fallback) return fallback
  if (storageKey.endsWith('.png')) return 'image/png'
  if (storageKey.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function migrateOne(client, row, field, dryRun) {
  const storageKey = row[field.storageKey]
  if (!storageKey) return { skipped: true }

  const key = sanitizeStorageKey(storageKey)
  const localPath = path.resolve(process.cwd(), 'public', 'uploads', key)
  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
  if (!localPath.startsWith(uploadsRoot)) {
    throw new Error('local_path_outside_uploads')
  }
  if (!fs.existsSync(localPath)) {
    return { skipped: true, reason: 'missing_local_file' }
  }

  if (dryRun) return { skipped: false, dryRun: true }

  const body = fs.readFileSync(localPath)
  await r2Request('PUT', key, {
    body,
    contentType: contentTypeForKey(key, row[field.contentType]),
  })
  const exists =
    (await r2Request('HEAD', key, { allowNotFound: true })).status !== 404
  if (!exists) throw new Error('r2_upload_not_verified')

  return { skipped: false, dryRun: false }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const dryRun = !process.argv.includes('--apply')
const userId = getArg('user-id')
const limit = Number(getArg('limit') ?? 50)
const config = getR2Config()

if (!isR2Configured(config)) {
  console.log(
    JSON.stringify(
      { ok: false, dryRun, error: 'r2_credentials_missing' },
      null,
      2,
    ),
  )
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      { ok: false, dryRun, error: 'database_url_missing' },
      null,
      2,
    ),
  )
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const where = userId ? 'where "userId" = $1' : ''
const params = userId ? [userId, limit] : [limit]
const limitParam = userId ? '$2' : '$1'
const result = await client.query(
  `
    select id, "userId", "imageStorageKey", "imageContentType",
      "originalImageStorageKey", "originalImageContentType",
      "processedImageStorageKey", "processedImageContentType"
    from wardrobe_item
    ${where}
    order by "createdAt" asc
    limit ${limitParam}
  `,
  params,
)

const fields = [
  {
    storageKey: 'imageStorageKey',
    contentType: 'imageContentType',
    url: 'imageUrl',
  },
  {
    storageKey: 'originalImageStorageKey',
    contentType: 'originalImageContentType',
    url: 'originalImageUrl',
  },
  {
    storageKey: 'processedImageStorageKey',
    contentType: 'processedImageContentType',
    url: 'processedImageUrl',
  },
]
const summary = {
  ok: true,
  dryRun,
  scanned: result.rowCount,
  uploaded: 0,
  skipped: 0,
  failed: 0,
}

for (const row of result.rows) {
  try {
    const updates = []
    const values = []

    for (const field of fields) {
      const outcome = await migrateOne(client, row, field, dryRun)
      if (outcome.skipped) {
        summary.skipped += 1
        continue
      }

      summary.uploaded += dryRun ? 0 : 1
      updates.push(`"${field.url}" = $${updates.length + 1}`)
      values.push(`/api/wardrobe/images/${row[field.storageKey]}`)
    }

    if (!dryRun && updates.length > 0) {
      values.push(row.id)
      await client.query(
        `update wardrobe_item set ${updates.join(', ')}, "updatedAt" = now() where id = $${values.length}`,
        values,
      )
    }
  } catch {
    summary.ok = false
    summary.failed += 1
  }
}

await client.end()
console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exitCode = 1
