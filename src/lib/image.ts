import { FULL, paperBox, textAngle, type CropBox } from '../core/imageops'

/*
 * Prepares a receipt photo on a canvas, entirely on the device, in two steps:
 * 1. orient(): fix the camera's orientation, resize, turn by 90° steps and
 *    straighten by a few degrees. The crop editor shows this.
 * 2. finish(): crop to the receipt and make a high-contrast grayscale copy
 *    that OCR reads better. (Enlarging small crops measured worse on our
 *    real receipts, so we don't.)
 */

/** Longest side we keep. Bigger only slows OCR down without helping it. */
const MAX_SIDE = 2000

export type Rotation = 0 | 90 | 180 | 270

export interface PreparedImage {
  /** Colour version shown to the user. */
  url: string
  width: number
  height: number
  /** Grayscale, contrast-stretched copy for Tesseract (same size as the colour one). */
  ocrCanvas: HTMLCanvasElement
}

export async function loadPhoto(file: Blob): Promise<ImageBitmap> {
  // 'from-image' applies the EXIF rotation phones store in photos
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** The photo turned by `rotation` plus `straighten` degrees, on white, at most MAX_SIDE. */
export function orient(photo: ImageBitmap, rotation: Rotation, straighten = 0): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SIDE / Math.max(photo.width, photo.height))
  const a = ((rotation + straighten) * Math.PI) / 180
  const w = photo.width * scale
  const h = photo.height * scale
  const canvas = canvasOf(Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)), Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a)))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(a)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(photo, -w / 2, -h / 2, w, h)
  return canvas
}

/** Where the receipt probably is, judged on a 200px copy (see core/imageops.ts). */
export function suggestCrop(canvas: HTMLCanvasElement): CropBox {
  const scale = 200 / Math.max(canvas.width, canvas.height)
  const small = canvasOf(canvas.width * scale, canvas.height * scale)
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0, small.width, small.height)
  return paperBox(ctx.getImageData(0, 0, small.width, small.height).data, small.width, small.height)
}

/** How far the receipt is tilted, as a Straighten value, judged on a 400px copy. */
export function suggestStraighten(photo: ImageBitmap): number {
  const canvas = orient(photo, 0)
  const scale = 400 / Math.max(canvas.width, canvas.height)
  const small = canvasOf(canvas.width * scale, canvas.height * scale)
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0, small.width, small.height)
  return textAngle(ctx.getImageData(0, 0, small.width, small.height).data, small.width, small.height, suggestCrop(canvas))
}

export async function finish(oriented: HTMLCanvasElement, crop: CropBox = FULL): Promise<PreparedImage> {
  const sx = crop.x0 * oriented.width
  const sy = crop.y0 * oriented.height
  const sw = (crop.x1 - crop.x0) * oriented.width
  const sh = (crop.y1 - crop.y0) * oriented.height
  const canvas = canvasOf(sw, sh)
  canvas.getContext('2d')!.drawImage(oriented, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read this image'))), 'image/jpeg', 0.9),
  )
  return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, ocrCanvas: enhance(canvas) }
}

/** Whole photo, no crop: used when retrying other rotations. */
export const preparePhoto = (photo: ImageBitmap, rotation: Rotation) => finish(orient(photo, rotation))

/**
 * Grayscale + contrast stretch: maps the 2nd–98th percentile of brightness
 * to full black–white, which brings faded thermal-paper text back.
 */
function enhance(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = image.data

  const histogram = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) {
    const gray = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    px[i] = gray
    histogram[gray]++
  }
  const pixels = px.length / 4
  const percentile = (p: number) => {
    let count = 0
    for (let v = 0; v < 256; v++) if ((count += histogram[v]) >= pixels * p) return v
    return 255
  }
  const low = percentile(0.02)
  const high = Math.max(low + 1, percentile(0.98))
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - low) * 255) / (high - low)))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
