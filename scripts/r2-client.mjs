import { createHash, createHmac, randomUUID } from 'node:crypto'

export function getR2Config() {
  const endpoint =
    process.env.R2_ENDPOINT ??
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined)

  return {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    endpoint: endpoint?.replace(/\/$/, ''),
    timeoutMs: Number(process.env.R2_REQUEST_TIMEOUT_MS ?? 10000),
  }
}

export function isR2Configured(config = getR2Config()) {
  return Boolean(
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucketName &&
    config.endpoint,
  )
}

export function sanitizeStorageKey(storageKey) {
  const normalized = storageKey.replace(/\\/g, '/')
  if (
    normalized.startsWith('/') ||
    normalized.includes('..') ||
    !normalized.startsWith('wardrobe/') ||
    !/^[a-zA-Z0-9/_.,=-]+$/.test(normalized)
  ) {
    throw new Error('Invalid storage key')
  }

  return normalized
}

export function createTemporaryStorageKey() {
  return `wardrobe/diagnostics/tmp/${randomUUID()}.txt`
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key, value) {
  return createHmac('sha256', key).update(value).digest()
}

function encodeKey(storageKey) {
  return storageKey.split('/').map(encodeURIComponent).join('/')
}

function getObjectUrl(config, storageKey) {
  const url = new URL(`${config.endpoint}/${config.bucketName}`)
  if (storageKey) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeKey(
      sanitizeStorageKey(storageKey),
    )}`
  }
  return url
}

function signRequest(config, method, url, payloadHash, contentType) {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const service = 's3'
  const region = 'auto'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const signedHeaders = contentType
    ? 'content-type;host;x-amz-content-sha256;x-amz-date'
    : 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = [
    contentType ? `content-type:${contentType}\n` : '',
    `host:${url.host}\n`,
    `x-amz-content-sha256:${payloadHash}\n`,
    `x-amz-date:${amzDate}\n`,
  ].join('')
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), region),
      service,
    ),
    'aws4_request',
  )
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex')

  return {
    ...(contentType ? { 'content-type': contentType } : {}),
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
}

export async function r2Request(method, storageKey, options = {}) {
  const config = getR2Config()
  if (!isR2Configured(config)) {
    throw new Error('r2_credentials_missing')
  }

  const body = options.body
  const payloadHash = sha256Hex(body ?? '')
  const url = getObjectUrl(config, storageKey)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers: signRequest(
        config,
        method,
        url,
        payloadHash,
        options.contentType,
      ),
      body,
      signal: controller.signal,
    })

    if (!response.ok && !(options.allowNotFound && response.status === 404)) {
      throw new Error(`r2_status_${response.status}`)
    }

    return response
  } finally {
    clearTimeout(timeout)
  }
}
