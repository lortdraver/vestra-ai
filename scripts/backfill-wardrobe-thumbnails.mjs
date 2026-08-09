import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import sharp from 'sharp'
import { r2Request, sanitizeStorageKey } from './r2-client.mjs'

const THUMBNAIL_MAX_DIMENSION = 480
const THUMBNAIL_QUALITY = 82
const THUMBNAIL_CONTENT_TYPE = 'image/webp'

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

function getStorageDriver() {
  return process.env.STORAGE_DRIVER === 'r2' ? 'r2' : 'local'
}

function safeUserId(userId) {
  return String(userId).replace(/[^a-zA-Z0-9_-]/g, '')
}

function buildThumbnailKey(userId) {
  return `wardrobe/${safeUserId(userId)}/thumb/${randomUUID()}.webp`
}

function localPathForKey(storageKey) {
  const key = sanitizeStorageKey(storageKey)
  const root = path.resolve(process.cwd(), 'public', 'uploads')
  const targetPath = path.resolve(root, key)
  const relative = path.relative(root, targetPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('local_path_outside_uploads')
  }
  return targetPath
}

async function objectExists(storageDriver, storageKey) {
  if (!storageKey) return false

  if (storageDriver === 'r2') {
    const response = await r2Request('HEAD', storageKey, {
      allowNotFound: true,
    })
    return response.status !== 404
  }

  return fs.existsSync(localPathForKey(storageKey))
}

async function readObject(storageDriver, storageKey) {
  if (storageDriver === 'r2') {
    const response = await r2Request('GET', storageKey)
    return Buffer.from(await response.arrayBuffer())
  }

  return fs.readFileSync(localPathForKey(storageKey))
}

async function writeObject(storageDriver, storageKey, body) {
  if (storageDriver === 'r2') {
    await r2Request('PUT', storageKey, {
      body,
      contentType: THUMBNAIL_CONTENT_TYPE,
    })
    return `/api/wardrobe/images/${storageKey}`
  }

  const targetPath = localPathForKey(storageKey)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, body)
  return `/uploads/${storageKey}`
}

function selectSource(row) {
  if (row.processedImageStorageKey) {
    return { storageKey: row.processedImageStorageKey, source: 'processed' }
  }

  return {
    storageKey: row.originalImageStorageKey ?? row.imageStorageKey,
    source: row.originalImageStorageKey ? 'original' : 'display',
  }
}

async function createThumbnail(body) {
  const output = await sharp(body)
    .rotate()
    .resize({
      width: THUMBNAIL_MAX_DIMENSION,
      height: THUMBNAIL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: THUMBNAIL_QUALITY,
      effort: 4,
      alphaQuality: THUMBNAIL_QUALITY,
    })
    .toBuffer()
  const metadata = await sharp(output).metadata()

  if (!metadata.width || !metadata.height || output.byteLength <= 0) {
    throw new Error('thumbnail_generation_invalid_output')
  }

  return { body: output, width: metadata.width, height: metadata.height }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const dryRun = !process.argv.includes('--apply')
const limit = Math.max(1, Math.min(Number(getArg('limit') ?? 50), 500))
const userId = getArg('user-id')
const storageDriver = getStorageDriver()

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

const params = userId ? [userId, limit] : [limit]
const where = userId ? 'and "userId" = $1' : ''
const limitParam = userId ? '$2' : '$1'
const result = await client.query(
  `
    select id, "userId", "imageStorageKey", "originalImageStorageKey",
      "processedImageStorageKey", "thumbnailImageStorageKey"
    from wardrobe_item
    where "imageDeletionStatus" = 'active'
      ${where}
    order by "createdAt" asc
    limit ${limitParam}
  `,
  params,
)

const summary = {
  ok: true,
  dryRun,
  storageDriver,
  scanned: result.rowCount,
  generated: 0,
  skippedExisting: 0,
  skippedMissingSource: 0,
  failed: 0,
}

for (const row of result.rows) {
  try {
    if (
      row.thumbnailImageStorageKey &&
      (await objectExists(storageDriver, row.thumbnailImageStorageKey))
    ) {
      summary.skippedExisting += 1
      continue
    }

    const source = selectSource(row)
    if (
      !source.storageKey ||
      !(await objectExists(storageDriver, source.storageKey))
    ) {
      summary.skippedMissingSource += 1
      continue
    }

    if (dryRun) {
      summary.generated += 1
      continue
    }

    const sourceBody = await readObject(storageDriver, source.storageKey)
    const thumbnail = await createThumbnail(sourceBody)
    const thumbnailKey = buildThumbnailKey(row.userId)
    const thumbnailUrl = await writeObject(
      storageDriver,
      thumbnailKey,
      thumbnail.body,
    )

    await client.query(
      `
        update wardrobe_item
        set "thumbnailImageUrl" = $1,
            "thumbnailImageStorageKey" = $2,
            "thumbnailImageContentType" = $3,
            "thumbnailImageSize" = $4,
            "thumbnailImageWidth" = $5,
            "thumbnailImageHeight" = $6,
            "updatedAt" = now()
        where id = $7
      `,
      [
        thumbnailUrl,
        thumbnailKey,
        THUMBNAIL_CONTENT_TYPE,
        String(thumbnail.body.byteLength),
        thumbnail.width,
        thumbnail.height,
        row.id,
      ],
    )
    summary.generated += 1
  } catch {
    summary.ok = false
    summary.failed += 1
  }
}

await client.end()
console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exitCode = 1
