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
