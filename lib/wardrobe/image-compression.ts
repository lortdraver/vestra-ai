import { maxUploadedImageBytes } from './constants'

const maxDimension = 1_600
const colorSampleDimension = 160
const initialQuality = 0.82

export type WardrobeImageColorHints = {
  colors: string[]
  dominantHexColors: string[]
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_load_failed'))
    }
    image.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('image_compression_failed'))
          return
        }
        resolve(blob)
      },
      'image/webp',
      quality,
    )
  })
}

export async function compressWardrobeImage(file: File): Promise<File> {
  if (file.size <= maxUploadedImageBytes && file.type === 'image/webp') {
    return file
  }

  const image = await loadImage(file)
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('canvas_unavailable')
  }

  context.drawImage(image, 0, 0, width, height)

  let quality = initialQuality
  let blob = await canvasToBlob(canvas, quality)

  while (blob.size > maxUploadedImageBytes && quality > 0.5) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size > maxUploadedImageBytes) {
    throw new Error('image_too_large')
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
    type: 'image/webp',
  })
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
  const image = await loadImage(file)
  const scale = Math.min(
    1,
    colorSampleDimension / Math.max(image.width, image.height),
  )
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('canvas_unavailable')
  }

  context.drawImage(image, 0, 0, width, height)
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
