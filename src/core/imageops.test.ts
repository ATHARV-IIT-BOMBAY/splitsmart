import { describe, expect, it } from 'vitest'
import { FULL, paperBox, textAngle } from './imageops'

/** A brown "table" with a white "receipt" rectangle and some black "text" on it. */
function photo(width: number, height: number, receipt: [number, number, number, number]) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const inside = x >= receipt[0] && x < receipt[2] && y >= receipt[1] && y < receipt[3]
      const text = inside && y % 6 === 0 && x % 4 !== 0
      const [r, g, b] = text ? [30, 30, 30] : inside ? [240, 238, 232] : [110, 70, 40]
      rgba.set([r, g, b, 255], i)
    }
  }
  return rgba
}

describe('paperBox', () => {
  it('finds the receipt on a table and ignores its text', () => {
    const box = paperBox(photo(200, 200, [60, 20, 140, 190]), 200, 200)
    expect(box.x0).toBeCloseTo(0.3, 1)
    expect(box.x1).toBeCloseTo(0.7, 1)
    expect(box.y0).toBeCloseTo(0.1, 1)
    expect(box.y1).toBeCloseTo(0.95, 1)
  })

  it('keeps the whole photo when the receipt already fills it', () => {
    expect(paperBox(photo(100, 100, [0, 0, 100, 100]), 100, 100)).toEqual(FULL)
  })
})

/** White paper with short dark "words" in rows, tilted so that turning it by `degrees` levels them. */
function tiltedText(size: number, degrees: number) {
  const a = (degrees * Math.PI) / 180
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = x * Math.sin(a) + y * Math.cos(a)
      const along = x * Math.cos(a) - y * Math.sin(a)
      if (((row % 12) + 12) % 12 < 2 && ((along % 8) + 8) % 8 < 5) rgba.fill(20, (y * size + x) * 4, (y * size + x) * 4 + 3)
    }
  }
  return rgba
}

describe('textAngle', () => {
  it('finds how far to turn tilted text, and leaves level text alone', () => {
    expect(textAngle(tiltedText(200, 0), 200, 200)).toBe(0)
    expect(Math.abs(textAngle(tiltedText(200, 30), 200, 200) - 30)).toBeLessThanOrEqual(1)
    expect(Math.abs(textAngle(tiltedText(200, -20), 200, 200) + 20)).toBeLessThanOrEqual(1)
  })

  it('gives 0 for a blank page', () => {
    expect(textAngle(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100)).toBe(0)
  })
})
