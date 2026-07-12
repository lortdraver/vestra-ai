import type {
  BackgroundRemovalApiResponse,
  BackgroundRemovalInput,
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
} from './provider'

function safeEndpointForLogs(endpoint: string) {
  try {
    const url = new URL(endpoint)
    url.search = ''
    return url.toString()
  } catch {
    return 'configured-endpoint'
  }
}

export class ApiBackgroundRemovalProvider implements BackgroundRemovalProvider {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly modelId: string
  private readonly timeoutMs: number

  constructor() {
    const apiKey = process.env.BACKGROUND_REMOVAL_API_KEY
    const endpoint = process.env.BACKGROUND_REMOVAL_API_URL

    if (!apiKey || !endpoint) {
      throw new Error(
        'Production background removal requires BACKGROUND_REMOVAL_API_KEY and BACKGROUND_REMOVAL_API_URL',
      )
    }

    this.apiKey = apiKey
    this.endpoint = endpoint
    this.modelId =
      process.env.BACKGROUND_REMOVAL_MODEL_ID ?? 'background-removal-v1'
    this.timeoutMs = Number(
      process.env.BACKGROUND_REMOVAL_REQUEST_TIMEOUT_MS ?? 15000,
    )
  }

  async removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const body = new FormData()
    body.set('image', input.file)
    body.set('mode', input.mode ?? 'single_item')
    body.set('modelId', this.modelId)

    let response: Response
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'image/png, application/json',
        },
        body,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Background removal provider timeout')
      }

      throw new Error('Background removal provider unavailable')
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response)
      if (process.env.NODE_ENV !== 'production') {
        console.error('[dev] Background removal provider failed', {
          status: response.status,
          contentType: response.headers.get('content-type'),
          message: errorBody,
          endpoint: safeEndpointForLogs(this.endpoint),
          modelId: this.modelId,
        })
      }

      throw new Error(
        `Background removal failed with status ${response.status}`,
      )
    }

    const contentType = response.headers.get('content-type') ?? 'image/png'
    const file = contentType.includes('application/json')
      ? await this.fileFromJsonResponse(response, input.file.name)
      : await this.fileFromBinaryResponse(
          response,
          input.file.name,
          contentType,
        )

    return {
      file,
      provider: 'api',
      modelId: this.modelId,
      mode: input.mode ?? 'single_item',
    }
  }

  private async fileFromBinaryResponse(
    response: Response,
    originalName: string,
    contentType: string,
  ) {
    const blob = await response.blob()
    return new File([blob], this.getProcessedFilename(originalName), {
      type: contentType,
      lastModified: Date.now(),
    })
  }

  private async fileFromJsonResponse(response: Response, originalName: string) {
    const data = (await response.json()) as BackgroundRemovalApiResponse
    const contentType = data.contentType ?? 'image/png'

    if (data.imageBase64) {
      const binary = Uint8Array.from(atob(data.imageBase64), (char) =>
        char.charCodeAt(0),
      )

      return new File([binary], this.getProcessedFilename(originalName), {
        type: contentType,
        lastModified: Date.now(),
      })
    }

    if (data.imageUrl) {
      const imageResponse = await fetch(data.imageUrl, {
        headers: { Accept: 'image/png,image/webp,image/jpeg' },
      })

      if (!imageResponse.ok) {
        throw new Error(
          `Background removal image download failed with status ${imageResponse.status}`,
        )
      }

      const imageContentType =
        imageResponse.headers.get('content-type') ?? contentType
      return this.fileFromBinaryResponse(
        imageResponse,
        originalName,
        imageContentType,
      )
    }

    throw new Error('Background removal API returned no processed image')
  }

  private async readErrorBody(response: Response) {
    try {
      const text = await response.text()
      return text.slice(0, 1000)
    } catch {
      return null
    }
  }

  private getProcessedFilename(originalName: string) {
    return `processed-${originalName.replace(/\.[^.]+$/, '')}.png`
  }
}
