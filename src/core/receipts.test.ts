import { describe, expect, it } from 'vitest'
import { checkTotal, parseReceipt, type OcrLine } from './parse'
import swiggy from './__fixtures__/swiggy-screenshot.txt?raw'
import zepto from './__fixtures__/zepto-invoice.txt?raw'
import zomato from './__fixtures__/zomato-invoice.txt?raw'
import gulmohar from './__fixtures__/gulmohar-bill.txt?raw'
import gulmohar2 from './__fixtures__/gulmohar-bill-2.txt?raw'
import h2Canteen from './__fixtures__/h2-canteen-bill.txt?raw'

/*
 * Real Tesseract output from receipts in fixtures/receipts (one OCR line per
 * text line; words ending in "?" had low confidence).
 */
function ocr(text: string): OcrLine[] {
  return text
    .trim()
    .split('\n')
    .map((raw, row) => {
      const words = raw
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, col) => ({
          text: word.replace(/\?$/, ''),
          confidence: word.endsWith('?') ? 40 : 95,
          bbox: { x0: col * 50, y0: row * 20, x1: col * 50 + 45, y1: row * 20 + 18 },
        }))
      return { text: words.map((w) => w.text).join(' '), words, bbox: { x0: 0, y0: row * 20, x1: 400, y1: row * 20 + 18 } }
    })
}

const summary = (text: string) => {
  const r = parseReceipt(ocr(text))
  return {
    items: r.items.map((i) => [i.name, i.qty, i.totalPaise / 100]),
    charges: r.charges.map((c) => [c.kind, c.label, c.paise / 100]),
    subtotal: r.subtotalPaise === undefined ? undefined : r.subtotalPaise / 100,
    total: r.totalPaise === undefined ? undefined : r.totalPaise / 100,
    check: checkTotal(r),
  }
}

describe('real receipts', () => {
  it('Swiggy screenshot: fixes ₹ read as "3" and lost decimal points', () => {
    const r = summary(swiggy)
    expect(r.items).toEqual([
      ['Veg Maharaja Mac Burger', 1, 235],
      ['Veg Pizza McPuff', 1, 69],
    ])
    expect(r.charges).toEqual([
      ['delivery', 'Restaurant Packaging', 19.05],
      ['other', 'Platform fee with GST', 17.98],
      ['discount', 'Discount Applied (TRYNEW)', -70],
      ['discount', 'Expiry Cash Discount', -60],
      ['tax', 'Taxes', 13.18],
      // Swiggy rounds the bill without printing it; we add the round-off line
      ['roundoff', 'Round off', -0.21],
    ])
    expect([r.subtotal, r.total]).toEqual([304, 224])
    expect(r.check.difference).toBe(0)
  })

  it('Zomato invoice: reads item names out of a wide tax table', () => {
    const r = summary(zomato)
    expect(r.items).toEqual([
      ['McVeggie Burger Combo', 1, 202.25],
      ['McAloo Tikki Burger', 1, 82.95],
      ['Veg Pizza McPuff', 1, 72.45],
    ])
    expect([r.subtotal, r.total]).toEqual([357.64, 397.65])
  })

  it('Zepto invoice: no PIN codes or row numbers become items', () => {
    const r = summary(zepto)
    expect(r.total).toBe(136)
    expect(r.items.every(([, qty, price]) => qty === 1 && (price as number) < 100)).toBe(true)
  })

  it('Gulmohar bill: all 13 items, and ignores "Total 8240" (a misread 3240)', () => {
    const r = summary(gulmohar)
    expect(r.items).toHaveLength(13)
    expect(r.items.slice(0, 3)).toEqual([
      ['FRUIT PUNC', 1, 150],
      ['SOFT DRINKS CAN', 1, 40],
      ['SWEET LASSI', 3, 195],
    ])
    // CGST printed as "T1.18" (77.15): T is a misread 7, and it counts as tax, not an item
    expect(r.charges.find((c) => c[0] === 'tax')).toEqual(['tax', 'CGST 62.5%', 71.18])
    expect([r.subtotal, r.total]).toEqual([3086, 3240.8])
  })

  it('H2 canteen bill: joins "253, 00" back into the total', () => {
    const r = summary(h2Canteen)
    expect(r.items.map((i) => i[2])).toEqual([108, 40, 40, 65])
    expect(r.total).toBe(253)
    expect(r.check.difference).toBe(0)
  })

  it('second Gulmohar bill: GST lines with misread "@" and comma decimals', () => {
    const r = summary(gulmohar2)
    expect(r.items.length).toBeGreaterThanOrEqual(11)
    expect(r.charges.filter((c) => c[0] === 'tax').map((c) => c[2])).toEqual([54.42, 54.42])
    expect([r.subtotal, r.total]).toEqual([2177.09, 2285.54])
  })
})
