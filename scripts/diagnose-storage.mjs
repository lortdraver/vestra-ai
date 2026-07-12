import fs from 'node:fs'
import path from 'node:path'
import {
  createTemporaryStorageKey,
  getR2Config,
  isR2Configured,
  r2Request,
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

loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

const driver = process.env.STORAGE_DRIVER ?? 'local'
const config = getR2Config()
const summary = {
  driver,
  r2: {
    hasAccountId: Boolean(process.env.R2_ACCOUNT_ID),
    hasAccessKeyId: Boolean(config.accessKeyId),
    hasSecretAccessKey: Boolean(config.secretAccessKey),
    hasBucketName: Boolean(config.bucketName),
    hasEndpoint: Boolean(config.endpoint),
    hasPublicBaseUrl: Boolean(process.env.R2_PUBLIC_BASE_URL),
    timeoutMs: config.timeoutMs,
  },
}

async function diagnoseR2() {
  if (!isR2Configured(config)) {
    console.log(
      JSON.stringify(
        { ...summary, ok: false, error: 'r2_credentials_missing' },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const key = createTemporaryStorageKey()
  const body = Buffer.from('vestra-r2-diagnostic')

  try {
    await r2Request('HEAD', null)
    await r2Request('PUT', key, { body, contentType: 'text/plain' })
    const read = await r2Request('GET', key)
    const readBody = Buffer.from(await read.arrayBuffer()).toString('utf8')
    await r2Request('DELETE', key)
    const existsAfterDelete =
      (await r2Request('HEAD', key, { allowNotFound: true })).status !== 404

    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: readBody === 'vestra-r2-diagnostic' && !existsAfterDelete,
          bucketConnectivity: true,
          temporaryUpload: true,
          temporaryRead: readBody === 'vestra-r2-diagnostic',
          temporaryDelete: !existsAfterDelete,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'storage_diagnostic_failed',
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
  }
}

if (driver === 'r2') {
  await diagnoseR2()
} else {
  console.log(
    JSON.stringify(
      {
        ...summary,
        ok: process.env.NODE_ENV !== 'production' && driver === 'local',
        message:
          driver === 'local'
            ? 'Local storage is development-only and is blocked for public production.'
            : 'Unsupported storage driver.',
      },
      null,
      2,
    ),
  )
}
