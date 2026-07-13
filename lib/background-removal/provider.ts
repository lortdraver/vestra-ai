export type BackgroundRemovalMode =
  'single_item' | 'mirror_selfie' | 'outfit_segmentation' | 'virtual_try_on'

export type BackgroundRemovalInput = {
  userId: string
  file: File
  mode?: BackgroundRemovalMode
}

export type BackgroundRemovalResult = {
  file: File
  provider: string
  modelId: string
  mode: BackgroundRemovalMode
}

export type BackgroundRemovalErrorCode =
  | 'background_removal_invalid_request'
  | 'background_removal_invalid_api_key'
  | 'background_removal_insufficient_credits'
  | 'background_removal_rate_limited'
  | 'background_removal_timeout'
  | 'background_removal_provider_unavailable'
  | 'background_removal_invalid_response'

export class BackgroundRemovalProviderError extends Error {
  constructor(
    readonly code: BackgroundRemovalErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'BackgroundRemovalProviderError'
  }
}

export type BackgroundRemovalApiResponse = {
  imageUrl?: string
  imageBase64?: string
  contentType?: string
  modelId?: string
}

export interface BackgroundRemovalProvider {
  removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult>
}
