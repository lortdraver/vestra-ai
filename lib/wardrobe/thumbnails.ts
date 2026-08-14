import type { StoredObject } from '@/lib/storage/types'

type SharpModule = typeof import('sharp')

export const WARDROBE_THUMBNAIL_MAX_DIMENSION = 480
export const WARDROBE_THUMBNAIL_QUALITY = 82
export const WARDROBE_THUMBNAIL_CONTENT_TYPE = 'image/webp'

export type WardrobeThumbnail = {
  file: File
  width: number
  height: number
  contentType: typeof WARDROBE_THUMBNAIL_CONTENT_TYPE
  size: number
}

export type ThumbnailSource = {
  file: File
  storageKey: string
  source: 'processed' | 'original'
}

export type ThumbnailRecord = {
  thumbnailImageUrl?: string | null
  thumbnailImageStorageKey?: string | null
  thumbnailImageContentType?: string | null
  thumbnailImageSize?: string | number | null
  thumbnailImageWidth?: number | null
  thumbnailImageHeight?: number | null
}

export function hasValidThumbnailRecord(record: ThumbnailRecord) {
  const size = Number(record.thumbnailImageSize ?? 0)
  return Boolean(
    record.thumbnailImageUrl &&
    record.thumbnailImageStorageKey &&
    record.thumbnailImageContentType?.startsWith('image/') &&
    Number.isFinite(size) &&
    size > 0 &&
    record.thumbnailImageWidth &&
    record.thumbnailImageWidth > 0 &&
    record.thumbnailImageHeight &&
    record.thumbnailImageHeight > 0,
  )
}

export function selectThumbnailUrl(input: {
  thumbnailImageUrl?: string | null
  processedImageUrl?: string | null
  imageUrl: string
}) {
  return input.thumbnailImageUrl ?? input.processedImageUrl ?? input.imageUrl
}

export function selectThumbnailSource(input: {
  original: File
  originalStorageKey: string
  processed?: File | null
  processedStorageKey?: string | null
}) {
  if (input.processed && input.processedStorageKey) {
    return {
      file: input.processed,
      storageKey: input.processedStorageKey,
      source: 'processed' as const,
    }
  }

  return {
    file: input.original,
    storageKey: input.originalStorageKey,
    source: 'original' as const,
  }
}

export async function generateWardrobeThumbnail(
  file: File,
): Promise<WardrobeThumbnail> {
  const sharp = await loadSharpRuntime()
  const input = new Uint8Array(await file.arrayBuffer())
  const output = await sharp(input)
    .rotate()
    .resize({
      width: WARDROBE_THUMBNAIL_MAX_DIMENSION,
      height: WARDROBE_THUMBNAIL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: WARDROBE_THUMBNAIL_QUALITY,
      effort: 4,
      alphaQuality: WARDROBE_THUMBNAIL_QUALITY,
    })
    .toBuffer()

  const metadata = await sharp(output).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (width <= 0 || height <= 0 || output.byteLength <= 0) {
    throw new Error('thumbnail_generation_invalid_output')
  }

  const fileName = `${file.name.replace(/\.[^.]+$/, '') || 'wardrobe'}-thumb.webp`
  const thumbnailFile = new File([output], fileName, {
    type: WARDROBE_THUMBNAIL_CONTENT_TYPE,
  })

  return {
    file: thumbnailFile,
    width,
    height,
    contentType: WARDROBE_THUMBNAIL_CONTENT_TYPE,
    size: output.byteLength,
  }
}

async function loadSharpRuntime() {
  try {
    const sharpModule: SharpModule = await import('sharp')
    console.info('[thumbnail] THUMBNAIL_RUNTIME_LOADED', {
      runtime: 'sharp',
      platform: process.platform,
      arch: process.arch,
    })
    return sharpModule.default
  } catch (error) {
    console.warn('[thumbnail] THUMBNAIL_RUNTIME_UNAVAILABLE', {
      runtime: 'sharp',
      platform: process.platform,
      arch: process.arch,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage:
        error instanceof Error
          ? sanitizeThumbnailRuntimeError(error.message)
          : String(error),
    })
    throw new Error('thumbnail_runtime_unavailable')
  }
}

function sanitizeThumbnailRuntimeError(message: string) {
  return message
    .replace(/[A-Z]:\\[^:\n]+/g, '<path>')
    .replace(/\/[^\s:]+/g, '<path>')
    .slice(0, 240)
}

export function serializeThumbnailObject(
  storedObject: StoredObject,
  thumbnail: WardrobeThumbnail,
) {
  return {
    thumbnailImageUrl: storedObject.url,
    thumbnailImageStorageKey: storedObject.storageKey,
    thumbnailImageContentType: storedObject.contentType,
    thumbnailImageSize: String(storedObject.size),
    thumbnailImageWidth: thumbnail.width,
    thumbnailImageHeight: thumbnail.height,
  }
}

export function logThumbnailStage(
  stage:
    | 'THUMBNAIL_GENERATION_STARTED'
    | 'THUMBNAIL_GENERATION_COMPLETED'
    | 'THUMBNAIL_GENERATION_FAILED',
  context: Record<string, unknown>,
) {
  const safeContext = {
    userPresent: Boolean(context.userId),
    itemPresent: Boolean(context.itemId),
    source: context.source,
    storageDriver: context.storageDriver,
    width: context.width,
    height: context.height,
    size: context.size,
    errorName: context.errorName,
    errorMessage: context.errorMessage,
  }

  const logger =
    stage === 'THUMBNAIL_GENERATION_FAILED' ? console.warn : console.info
  logger(`[thumbnail] ${stage}`, safeContext)
}
