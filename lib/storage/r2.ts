import { createHash, createHmac, randomUUID } from 'node:crypto'
import type {
  ObjectStorage,
  StoredObject,
  StorageObject,
  StoreObjectInput,
} from './types'

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type R2Config = {
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  endpoint: string
  publicBaseUrl: string | null
  timeoutMs: number
}

function sha256Hex(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest()
}

function encodeKey(storageKey: string) {
  return storageKey.split('/').map(encodeURIComponent).join('/')
}

export function sanitizeStorageKey(storageKey: string) {
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

export function buildWardrobeStorageKey(input: StoreObjectInput) {
  const extension = extensionByType[input.file.type]
  if (!extension) {
    throw new Error('Unsupported image content type')
  }

  const safeUserId = input.userId.replace(/[^a-zA-Z0-9_-]/g, '')
  const variant = input.variant ?? 'processed'
  return `wardrobe/${safeUserId}/${variant}/${randomUUID()}.${extension}`
}

export class R2ObjectStorage implements ObjectStorage {
  private readonly config: R2Config

  constructor() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME
    const endpoint =
      process.env.R2_ENDPOINT ??
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined)

    if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
      throw new Error('R2 storage requires Cloudflare R2 credentials')
    }

    this.config = {
      accessKeyId,
      secretAccessKey,
      bucketName,
      endpoint: endpoint.replace(/\/$/, ''),
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? null,
      timeoutMs: Number(process.env.R2_REQUEST_TIMEOUT_MS ?? 10000),
    }
  }

  async putWardrobeImage(input: StoreObjectInput): Promise<StoredObject> {
    const storageKey = buildWardrobeStorageKey(input)
    const body = new Uint8Array(await input.file.arrayBuffer())

    await this.request('PUT', storageKey, {
      body,
      contentType: input.file.type,
    })

    return {
      url: `/api/wardrobe/images/${encodeKey(storageKey)}`,
      storageKey,
      contentType: input.file.type,
      size: input.file.size,
    }
  }

  async getObject(storageKey: string): Promise<StorageObject> {
    const response = await this.request('GET', storageKey)
    const body = new Uint8Array(await response.arrayBuffer())

    return {
      body,
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
      size: Number(response.headers.get('content-length') ?? body.byteLength),
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.request('DELETE', storageKey)
  }

  async exists(storageKey: string): Promise<boolean> {
    const response = await this.request('HEAD', storageKey, {
      allowNotFound: true,
    })
    return response.status !== 404
  }

  async healthCheck() {
    try {
      await this.request('HEAD', null)
      return { ok: true, driver: 'r2', configured: true }
    } catch (error) {
      return {
        ok: false,
        driver: 'r2',
        configured: true,
        message:
          error instanceof Error
            ? sanitizeStorageError(error.message)
            : 'r2_unavailable',
      }
    }
  }

  private async request(
    method: string,
    storageKey: string | null,
    options: {
      body?: Uint8Array
      contentType?: string
      allowNotFound?: boolean
    } = {},
  ) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)
    const url = this.getObjectUrl(storageKey)
    const body = options.body
    const payloadHash = sha256Hex(body ?? '')
    const headers = this.signRequest(
      method,
      url,
      payloadHash,
      options.contentType,
    )

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      })

      if (!response.ok && !(options.allowNotFound && response.status === 404)) {
        throw new Error(`R2 request failed with status ${response.status}`)
      }

      return response
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('R2 request timed out')
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private getObjectUrl(storageKey: string | null) {
    const url = new URL(`${this.config.endpoint}/${this.config.bucketName}`)
    if (storageKey) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeKey(
        sanitizeStorageKey(storageKey),
      )}`
    }
    return url
  }

  private signRequest(
    method: string,
    url: URL,
    payloadHash: string,
    contentType?: string,
  ) {
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
        hmac(hmac(`AWS4${this.config.secretAccessKey}`, dateStamp), region),
        service,
      ),
      'aws4_request',
    )
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex')

    return {
      ...(contentType ? { 'content-type': contentType } : {}),
      authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    }
  }
}

function sanitizeStorageError(message: string) {
  return message.replace(/Credential=[^,\s]+/g, 'Credential=<redacted>')
}
