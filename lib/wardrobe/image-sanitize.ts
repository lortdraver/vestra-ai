/**
 * Server-side upload sanitization. The client-declared MIME type is not
 * trusted: the bytes are decoded with sharp, the real format is detected, and
 * the image is re-encoded. Re-encoding drops EXIF/GPS and any non-image
 * payload, applies EXIF orientation, and bounds the pixel size (which also
 * bounds background-removal and vision costs).
 */
export const UPLOAD_MAX_DIMENSION = 2048

const formatToContentType = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const

type SupportedFormat = keyof typeof formatToContentType

export class ImageSanitizeError extends Error {
  constructor(readonly code: 'invalid_image_type') {
    super(code)
    this.name = 'ImageSanitizeError'
  }
}

function isSupportedFormat(format: unknown): format is SupportedFormat {
  return typeof format === 'string' && format in formatToContentType
}

export async function sanitizeUploadedImage(file: File): Promise<File> {
  const { default: sharp } = await import('sharp')
  const input = new Uint8Array(await file.arrayBuffer())

  let format: SupportedFormat
  try {
    const metadata = await sharp(input).metadata()
    if (!isSupportedFormat(metadata.format)) {
      throw new ImageSanitizeError('invalid_image_type')
    }
    format = metadata.format
  } catch (error) {
    if (error instanceof ImageSanitizeError) throw error
    throw new ImageSanitizeError('invalid_image_type')
  }

  const pipeline = sharp(input).rotate().resize({
    width: UPLOAD_MAX_DIMENSION,
    height: UPLOAD_MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  })

  const output =
    format === 'jpeg'
      ? await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
      : format === 'png'
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : await pipeline.webp({ quality: 90 }).toBuffer()

  const contentType = formatToContentType[format]
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload'
  const extension = format === 'jpeg' ? 'jpg' : format

  return new File([new Uint8Array(output)], `${baseName}.${extension}`, {
    type: contentType,
    lastModified: Date.now(),
  })
}
