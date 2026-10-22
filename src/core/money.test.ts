import { describe, expect, it } from 'vitest'
import { allocate } from './allocate'
import { formatINR, parseRupees } from './money'

describe('formatINR', () => {
  it('uses Indian digit grouping and two decimals', () => {
    expect(formatINR(12345050)).toBe('₹1,23,450.50')
    expect(formatINR(3334)).toBe('₹33.34')
  })
})

describe('parseRupees', () => {
  it.each([
    ['80', 8000],
    ['80.5', 8050],
    ['0.29', 29],
    ['1,250.00', 125000],
    ['₹ 80', 8000],
    ['Rs. 80', 8000],
    ['80/-', 8000],
    ['-20.00', -2000],
  ])('%s → %i paise', (text, paise) => {
    expect(parseRupees(text)).toBe(paise)
  })

  it.each(['', 'abc', '12.345', '1.2.3', 'S0.00'])('rejects %j', (text) => {
    expect(parseRupees(text)).toBeNull()
  })
})

describe('allocate', () => {
  it('splits ₹100 three ways as 33.34 / 33.33 / 33.33', () => {
    expect(allocate(10000, [1, 1, 1])).toEqual([3334, 3333, 3333])
  })

  it('gives tied leftover paise to the first in priority', () => {
    expect(allocate(10000, [1, 1, 1], [2, 0, 1])).toEqual([3333, 3333, 3334])
  })

  it('gives leftovers to the largest remainders before priority', () => {
    // exact shares: 16.67, 33.33, 50 → the 0.67 remainder wins the paisa
    expect(allocate(10000, [1, 2, 3], [1, 0, 2])).toEqual([1667, 3333, 5000])
  })

  it('splits proportionally: ₹100 tax on ₹600 of ₹1,000 is ₹60', () => {
    expect(allocate(10000, [60000, 40000])).toEqual([6000, 4000])
  })

  it('splits negative amounts (discounts) and keeps the sum exact', () => {
    const parts = allocate(-1000, [1, 1, 1])
    expect(parts).toEqual([-334, -333, -333])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-1000)
  })

  it('gives nothing to zero weights', () => {
    expect(allocate(500, [0, 1, 0])).toEqual([0, 500, 0])
    expect(Object.is(allocate(-500, [0, 1])[0], 0)).toBe(true)
  })

  it('always adds up to the total', () => {
    for (let run = 0; run < 500; run++) {
      const total = Math.floor(Math.random() * 1_000_000) - 200_000
      const weights = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, () =>
        Math.floor(Math.random() * 1000),
      )
      if (!weights.some((w) => w > 0)) weights[0] = 1
      const parts = allocate(total, weights)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
    }
  })

  it('rejects bad input', () => {
    expect(() => allocate(100, [0, 0])).toThrow(RangeError)
    expect(() => allocate(100, [1, -1])).toThrow(RangeError)
    expect(() => allocate(10.5, [1])).toThrow(RangeError)
    expect(allocate(0, [0, 0])).toEqual([0, 0])
  })
})
