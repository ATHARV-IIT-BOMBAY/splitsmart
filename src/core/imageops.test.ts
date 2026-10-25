import { describe, expect, it } from 'vitest'
import { FULL, paperBox } from './imageops'

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
