import { maxUploadedImageBytes } from './constants'

export const maxClientImageDimension = 1_800
const colorSampleDimension = 160
const initialQuality = 0.86
const minimumQuality = 0.58

type ClientImageStage =
  | 'CLIENT_IMAGE_SELECTED'
  | 'CLIENT_IMAGE_DECODE_STARTED'
  | 'CLIENT_IMAGE_DECODE_COMPLETED'
  | 'CLIENT_IMAGE_RESIZE_STARTED'
  | 'CLIENT_IMAGE_EXPORT_COMPLETED'
  | 'CLIENT_IMAGE_COMPRESSION_FAILED'
  | 'CLIENT_IMAGE_FALLBACK_ORIGINAL'

type DecodedImage =
  | {
      source: ImageBitmap
      width: number
      height: number
      close: () => void
    }
  | {
      source: HTMLImageElement
      width: number
      height: number
      close: () => void
    }

type CompressionDiagnostics = {
  stage?: string
  inputMimeType?: string
  inputWidth?: number
  inputHeight?: number
  inputBytes?: number
  outputMimeType?: string
  outputWidth?: number
  outputHeight?: number
  outputBytes?: number
  errorName?: string
  errorMessage?: string
}

export type WardrobeImageColorHints = {
  colors: string[]
  dominantHexColors: string[]
}

function getClientImageCapabilities() {
  return {
    createImageBitmap: typeof createImageBitmap === 'function',
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    htmlCanvas: typeof document !== 'undefined',
    canvasToBlob:
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.toBlob === 'function',
  }
}

export function logClientImageStage(
  stage: ClientImageStage,
  context: CompressionDiagnostics = {},
) {
  const payload = {
    capabilities: getClientImageCapabilities(),
    inputMimeType: context.inputMimeType,
    inputWidth: context.inputWidth,
    inputHeight: context.inputHeight,
    inputBytes: context.inputBytes,
    outputMimeType: context.outputMimeType,
    outputWidth: context.outputWidth,
    outputHeight: context.outputHeight,
    outputBytes: context.outputBytes,
    failureStage: context.stage,
    errorName: context.errorName,
    errorMessage: context.errorMessage?.slice(0, 180),
  }

  const logger =
    stage === 'CLIENT_IMAGE_COMPRESSION_FAILED' ? console.warn : console.info
  logger(`[wardrobe-image] ${stage}`, payload)
}

function isFileWithAlpha(file: File) {
  return file.type === 'image/png' || file.type === 'image/webp'
}

export function getCompressedImageFileName(fileName: string, mimeType: string) {
  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : 'jpg'
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'wardrobe-image'
  return `${baseName}.${extension}`
}

export function getPreferredExportTypes(file: File) {
  if (file.type === 'image/jpeg') {
    return ['image/jpeg', 'image/webp'] as const
  }

  if (file.type === 'image/png') {
    return ['image/webp', 'image/png'] as const
  }

  return ['image/webp', 'image/png', 'image/jpeg'] as const
}

async function decodeWithCreateImageBitmap(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })

  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  }
}

function decodeWithHtmlImage(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        source: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        close: () => undefined,
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_load_failed'))
    }
    image.src = url
  })
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await decodeWithCreateImageBitmap(file)
    } catch {
      // Safari can expose createImageBitmap but fail for camera JPEGs.
    }
  }

  return decodeWithHtmlImage(file)
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size <= 0) {
          reject(new Error(`canvas_export_failed:${mimeType}`))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

async function exportCanvas(
  canvas: HTMLCanvasElement,
  file: File,
  width: number,
  height: number,
) {
  let lastError: unknown

  for (const mimeType of getPreferredExportTypes(file)) {
    let quality = mimeType === 'image/png' ? 1 : initialQuality

    try {
      let blob = await canvasToBlob(canvas, mimeType, quality)

      while (
        blob.size > maxUploadedImageBytes &&
        quality > minimumQuality &&
        mimeType !== 'image/png'
      ) {
        quality = Math.max(minimumQuality, quality - 0.08)
        blob = await canvasToBlob(canvas, mimeType, quality)
      }

      if (blob.size > maxUploadedImageBytes) {
        lastError = new Error('image_too_large')
        continue
      }

      logClientImageStage('CLIENT_IMAGE_EXPORT_COMPLETED', {
        inputMimeType: file.type,
        inputBytes: file.size,
        outputMimeType: mimeType,
        outputWidth: width,
        outputHeight: height,
        outputBytes: blob.size,
      })

      return new File([blob], getCompressedImageFileName(file.name, mimeType), {
        type: mimeType,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('image_compression_failed')
}

export async function compressWardrobeImage(file: File): Promise<File> {
  logClientImageStage('CLIENT_IMAGE_SELECTED', {
    inputMimeType: file.type,
    inputBytes: file.size,
  })

  if (file.size <= maxUploadedImageBytes && file.type === 'image/webp') {
    return file
  }

  let decoded: DecodedImage | null = null
  let failureStage: ClientImageStage = 'CLIENT_IMAGE_DECODE_STARTED'

  try {
    logClientImageStage('CLIENT_IMAGE_DECODE_STARTED', {
      inputMimeType: file.type,
      inputBytes: file.size,
    })
    decoded = await decodeImage(file)
    logClientImageStage('CLIENT_IMAGE_DECODE_COMPLETED', {
      inputMimeType: file.type,
      inputWidth: decoded.width,
      inputHeight: decoded.height,
      inputBytes: file.size,
    })

    failureStage = 'CLIENT_IMAGE_RESIZE_STARTED'
    const scale = Math.min(
      1,
      maxClientImageDimension / Math.max(decoded.width, decoded.height),
    )
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))
    logClientImageStage('CLIENT_IMAGE_RESIZE_STARTED', {
      inputMimeType: file.type,
      inputWidth: decoded.width,
      inputHeight: decoded.height,
      inputBytes: file.size,
      outputWidth: width,
      outputHeight: height,
    })

    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d', {
      alpha: isFileWithAlpha(file),
    })

    if (!context) {
      throw new Error('canvas_unavailable')
    }

    context.drawImage(decoded.source, 0, 0, width, height)
    failureStage = 'CLIENT_IMAGE_EXPORT_COMPLETED'
    return await exportCanvas(canvas, file, width, height)
  } catch (error) {
    logClientImageStage('CLIENT_IMAGE_COMPRESSION_FAILED', {
      stage: failureStage,
      inputMimeType: file.type,
      inputWidth: decoded?.width,
      inputHeight: decoded?.height,
      inputBytes: file.size,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    decoded?.close()
  }
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0')
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function colorName(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const saturation =
    max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255))

  if (saturation < 0.12) {
    if (lightness > 210) return 'light grey'
    if (lightness > 130) return 'grey'
    if (lightness > 55) return 'dark grey'
    return 'black'
  }

  if (red > green + 35 && red > blue + 35) return 'red'
  if (blue > red + 30 && blue > green + 20) return 'blue'
  if (green > red + 25 && green > blue + 20) return 'green'
  if (red > 180 && green > 140 && blue < 90) return 'yellow'
  if (red > 150 && green > 80 && blue < 80) return 'orange'
  if (red > 120 && blue > 120 && green < 120) return 'purple'
  if (red > 150 && green > 110 && blue > 100) return 'pink'
  if (red > 100 && green > 70 && blue < 65) return 'brown'

  return 'mixed'
}

export async function extractWardrobeImageColors(
  file: File,
): Promise<WardrobeImageColorHints> {
  const image = await decodeWithHtmlImage(file)
  const scale = Math.min(
    1,
    colorSampleDimension / Math.max(image.width, image.height),
  )
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('canvas_unavailable')
  }

  context.drawImage(image.source, 0, 0, width, height)
  image.close()
  const data = context.getImageData(0, 0, width, height).data
  const centerX = width / 2
  const centerY = height / 2
  const radiusX = width * 0.42
  const radiusY = height * 0.46
  const buckets = new Map<
    string,
    { count: number; red: number; green: number; blue: number }
  >()
  let garmentWeightedPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ellipse =
        ((x - centerX) * (x - centerX)) / (radiusX * radiusX) +
        ((y - centerY) * (y - centerY)) / (radiusY * radiusY)
      if (ellipse > 1) continue

      const index = (y * width + x) * 4
      const alpha = data[index + 3]
      if (alpha < 180) continue

      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const max = Math.max(red, green, blue)
      const min = Math.min(red, green, blue)
      const isLikelyWhiteBackground = max > 232 && max - min < 18
      if (isLikelyWhiteBackground) continue

      const bucketRed = Math.round(red / 24) * 24
      const bucketGreen = Math.round(green / 24) * 24
      const bucketBlue = Math.round(blue / 24) * 24
      const key = `${bucketRed}-${bucketGreen}-${bucketBlue}`
      const existing = buckets.get(key) ?? {
        count: 0,
        red: 0,
        green: 0,
        blue: 0,
      }

      existing.count += 1
      existing.red += red
      existing.green += green
      existing.blue += blue
      buckets.set(key, existing)
      garmentWeightedPixels += 1
    }
  }

  if (garmentWeightedPixels === 0) {
    return { colors: [], dominantHexColors: [] }
  }

  const dominant = Array.from(buckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 4)
    .map((bucket) => {
      const red = Math.round(bucket.red / bucket.count)
      const green = Math.round(bucket.green / bucket.count)
      const blue = Math.round(bucket.blue / bucket.count)
      return {
        hex: rgbToHex(red, green, blue),
        name: colorName(red, green, blue),
      }
    })

  return {
    colors: Array.from(new Set(dominant.map((color) => color.name))).filter(
      (name) => name !== 'mixed',
    ),
    dominantHexColors: dominant.map((color) => color.hex),
  }
}
