/*
 * Pure image maths on RGBA pixels, so it can be unit-tested without a browser.
 */

/** A rectangle as fractions (0–1) of the image's width and height. */
export interface CropBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export const FULL: CropBox = { x0: 0, y0: 0, x1: 1, y1: 1 }

/**
 * Guesses where the receipt is in a photo: the biggest patch of bright,
 * colourless pixels (paper), ignoring hands, tables and bags around it.
 * Pass a small image (~200px). Returns FULL when the paper fills the photo.
 */
export function paperBox(rgba: Uint8ClampedArray, width: number, height: number): CropBox {
  const n = width * height
  const lum = new Float32Array(n)
  for (let i = 0; i < n; i++) lum[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  // "Bright" is relative: the top 40% of the photo, but never darker than 170
  const cut = Math.min(170, [...lum].sort((a, b) => a - b)[Math.floor(n * 0.6)])

  const paper = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const [r, g, b] = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]
    const max = Math.max(r, g, b)
    const saturation = max ? (max - Math.min(r, g, b)) / max : 0
    paper[i] = lum[i] >= cut && saturation < 0.22 ? 1 : 0
  }
  // Grow by one pixel so printed text doesn't split the paper into pieces
  const grown = new Uint8Array(n)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let any = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy]
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) any |= paper[ny * width + nx]
        }
      }
      grown[y * width + x] = any
    }
  }

  // Largest connected patch wins
  const seen = new Uint8Array(n)
  let best = { size: 0, x0: 0, y0: 0, x1: width - 1, y1: height - 1 }
  for (let start = 0; start < n; start++) {
    if (!grown[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    const patch = { size: 0, x0: width, y0: height, x1: 0, y1: 0 }
    while (stack.length) {
      const p = stack.pop()!
      const [x, y] = [p % width, Math.floor(p / width)]
      patch.size++
      patch.x0 = Math.min(patch.x0, x)
      patch.x1 = Math.max(patch.x1, x)
      patch.y0 = Math.min(patch.y0, y)
      patch.y1 = Math.max(patch.y1, y)
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q >= 0 && q < n && grown[q] && !seen[q]) {
          seen[q] = 1
          stack.push(q)
        }
      }
    }
    if (patch.size > best.size) best = patch
  }

  const box = { x0: best.x0 / width, y0: best.y0 / height, x1: (best.x1 + 1) / width, y1: (best.y1 + 1) / height }
  const area = (box.x1 - box.x0) * (box.y1 - box.y0)
  // Tiny patches are noise and near-full ones mean the photo is already cropped
  return area < 0.08 || area > 0.85 ? FULL : box
}
