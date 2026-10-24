/*
 * Prepares a receipt photo on a canvas, entirely on the device:
 * fixes the camera's orientation, shrinks huge photos, rotates on request,
 * and makes a high-contrast grayscale copy that OCR reads better.
 */

/** Longest side we keep. Bigger only slows OCR down without helping it. */
const MAX_SIDE = 2000

export type Rotation = 0 | 90 | 180 | 270

export interface PreparedImage {
  /** Colour version shown to the user. */
  url: string
  width: number
  height: number
  /** Grayscale, contrast-stretched copy for Tesseract. */
  ocrCanvas: HTMLCanvasElement
}

export async function loadPhoto(file: Blob): Promise<ImageBitmap> {
  // 'from-image' applies the EXIF rotation phones store in photos
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

export async function preparePhoto(photo: ImageBitmap, rotation: Rotation): Promise<PreparedImage> {
  const scale = Math.min(1, MAX_SIDE / Math.max(photo.width, photo.height))
  const w = Math.round(photo.width * scale)
  const h = Math.round(photo.height * scale)
  const sideways = rotation === 90 || rotation === 270

  const canvas = document.createElement('canvas')
  canvas.width = sideways ? h : w
  canvas.height = sideways ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(photo, -w / 2, -h / 2, w, h)

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read this image'))), 'image/jpeg', 0.9),
  )
  return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, ocrCanvas: enhance(canvas) }
}

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
