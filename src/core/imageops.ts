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

/**
 * How many degrees to turn the photo so the receipt's text rows run level
 * (the Straighten value). Tries each angle and keeps the one where dark
 * pixels bunch into the fewest, fullest rows. Pass a small image (~400px)
 * and the paper box, so the table around the receipt doesn't count.
 */
export function textAngle(rgba: Uint8ClampedArray, width: number, height: number, box: CropBox = FULL, maxAngle = 45): number {
  const [bx0, by0] = [Math.floor(box.x0 * width), Math.floor(box.y0 * height)]
  const [bx1, by1] = [Math.ceil(box.x1 * width), Math.ceil(box.y1 * height)]
  const lum = new Float32Array(width * height)
  for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  const inside: number[] = []
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) inside.push(lum[y * width + x])
  const paper = [...inside].sort((a, b) => a - b)[Math.floor(inside.length * 0.7)]

  // Print: a dark pixel with mostly paper around it (so bags, shadows and table edges don't count)
  const xs: number[] = []
  const ys: number[] = []
  for (let y = Math.max(by0, 2); y < Math.min(by1, height - 2); y++) {
    for (let x = Math.max(bx0, 2); x < Math.min(bx1, width - 2); x++) {
      if (lum[y * width + x] >= paper * 0.6) continue
      let bright = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (lum[(y + dy) * width + x + dx] >= paper * 0.85) bright++
      if (bright >= 12) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  if (xs.length < 50) return 0

  const sharpness = (degrees: number) => {
    const a = (degrees * Math.PI) / 180
    const [sin, cos] = [Math.sin(a), Math.cos(a)]
    const offset = width + height
    const rows = new Float64Array(2 * offset + 2)
    for (let i = 0; i < xs.length; i++) {
      // Split each pixel between its two nearest rows, or the pixel grid itself looks like text at 45°
      const at = xs[i] * sin + ys[i] * cos + offset
      const row = Math.floor(at)
      rows[row] += row + 1 - at
      rows[row + 1] += at - row
    }
    // Level text gives sharp jumps between full rows and the gaps between them
    let score = 0
    for (let r = 1; r < rows.length; r++) score += (rows[r] - rows[r - 1]) ** 2
    return score
  }
  let best = 0
  let bestScore = sharpness(0)
  for (let d = -maxAngle; d <= maxAngle; d++) {
    const score = sharpness(d)
    // Prefer level unless another angle is clearly better
    if (score > bestScore * 1.05) [best, bestScore] = [d, score]
  }
  return best
}
