import type {
  BackgroundRemovalInput,
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
} from './provider'
import { BackgroundRemovalProviderError } from './provider'

function mapRemoveBgStatus(status: number) {
  if (status === 400) return 'background_removal_invalid_request'
  if (status === 401 || status === 403) {
    return 'background_removal_invalid_api_key'
  }
  if (status === 402) return 'background_removal_insufficient_credits'
  if (status === 429) return 'background_removal_rate_limited'
  return 'background_removal_provider_unavailable'
}

function isImageContentType(contentType: string | null) {
  return Boolean(contentType?.startsWith('image/'))
}

function hasKnownImageSignature(bytes: Uint8Array) {
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50

  return isPng || isJpeg || isWebp
}

export class RemoveBgBackgroundRemovalProvider implements BackgroundRemovalProvider {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly timeoutMs: number
  private readonly size: string

  constructor() {
    const apiKey = process.env.BACKGROUND_REMOVAL_API_KEY
    if (!apiKey) {
      throw new Error('remove.bg requires BACKGROUND_REMOVAL_API_KEY')
    }

    this.apiKey = apiKey
    this.endpoint =
      process.env.BACKGROUND_REMOVAL_API_URL ??
      'https://api.remove.bg/v1.0/removebg'
    this.timeoutMs = Number(
      process.env.BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS ?? 15000,
    )
    this.size = process.env.BACKGROUND_REMOVAL_SIZE ?? 'auto'
  }

  async removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult> {
    const body = new FormData()
    body.set('image_file', input.file)
    body.set('size', this.size)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
          Accept: 'image/png',
        },
        body,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new BackgroundRemovalProviderError(
          'background_removal_timeout',
          'remove.bg request timed out',
        )
      }

      throw new BackgroundRemovalProviderError(
        'background_removal_provider_unavailable',
        'remove.bg provider unavailable',
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new BackgroundRemovalProviderError(
        mapRemoveBgStatus(response.status),
        `remove.bg request failed with status ${response.status}`,
        response.status,
      )
    }

    const contentType = response.headers.get('content-type')
    if (!isImageContentType(contentType)) {
      throw new BackgroundRemovalProviderError(
        'background_removal_invalid_response',
        'remove.bg returned a non-image response',
        response.status,
      )
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0 || !hasKnownImageSignature(bytes)) {
      throw new BackgroundRemovalProviderError(
        'background_removal_invalid_response',
        'remove.bg returned an invalid image',
        response.status,
      )
    }

    return {
      file: new File([bytes], this.getProcessedFilename(input.file.name), {
        type: contentType ?? 'image/png',
        lastModified: Date.now(),
      }),
      provider: 'removebg',
      modelId: 'removebg-v1',
      mode: input.mode ?? 'single_item',
    }
  }

  private getProcessedFilename(originalName: string) {
    return `processed-${originalName.replace(/\.[^.]+$/, '')}.png`
  }
}
