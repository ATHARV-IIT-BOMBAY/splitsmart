import { describe, expect, it } from 'vitest'
import { checkTotal, parseReceipt, readAmount, type OcrLine } from './parse'

/** Builds fake OCR lines from plain text. Words ending in "?" get low confidence. */
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

describe('readAmount', () => {
  it.each([
    ['80.00', 8000],
    ['80', 8000],
    ['1,250.00', 125000],
    ['₹840', 84000],
    ['Rs.99.50', 9950],
    ['12O.00', 12000],
    ['8O,OO', 8000],
    ['60/-', 6000],
  ])('%s → %i', (token, paise) => expect(readAmount(token)).toBe(paise))

  it.each(['Maggi', '2.5%', 'GSTIN', 'x2', '@'])('ignores %s', (token) => expect(readAmount(token)).toBeNull())
})

describe('parseReceipt', () => {
  const canteen = ocr(`
    NIGHT CANTEEN H-12
    Powai, Mumbai 400076
    GSTIN 27ABCDE1234F1Z5
    Ph 9876543210
    Bill No 1042 Date 22/10/26
    Item Qty Rate Amount
    Large Pizza 1 400.00 400.00
    Maggi 3 60.00 180.00
    Cold Coffee 1 12O.00? 120.00?
    Garlic Bread 100.00
    Sub Total 800.00
    CGST @ 2.5% 20.00
    SGST @ 2.5% 20.00
    Grand Total 840.00
    Thank you! Visit again
  `)

  it('reads items, quantities and unit prices', () => {
    const { items } = parseReceipt(canteen)
    expect(items.map((i) => [i.name, i.qty, i.unitPaise, i.totalPaise])).toEqual([
      ['Large Pizza', 1, 40000, 40000],
      ['Maggi', 3, 6000, 18000],
      ['Cold Coffee', 1, 12000, 12000],
      ['Garlic Bread', 1, 10000, 10000],
    ])
  })

  it('reads taxes, subtotal and total, and skips address, GSTIN, phone and footer', () => {
    const r = parseReceipt(canteen)
    expect(r.charges.map((c) => [c.label, c.kind, c.paise])).toEqual([
      ['CGST @ 2.5%', 'tax', 2000],
      ['SGST @ 2.5%', 'tax', 2000],
    ])
    expect(r.subtotalPaise).toBe(80000)
    expect(r.totalPaise).toBe(84000)
    expect(checkTotal(r)).toEqual({ calculated: 84000, printed: 84000, difference: 0 })
  })

  it('flags low-confidence prices for review', () => {
    const coffee = parseReceipt(canteen).items[2]
    expect(coffee.doubtfulAmount).toBe(true)
    expect(parseReceipt(canteen).items[0].doubtfulAmount).toBe(false)
  })

  it('handles "2 x 60" style, leading quantities, discounts, service charge and round off', () => {
    const r = parseReceipt(
      ocr(`
        Paneer Tikka 2 x 180.00 360.00
        2 Butter Naan 80.00
        Total 440.00
        Discount 10% 44.00
        Service Charge 5% 19.80
        CGST 2.5% 10.40
        SGST 2.5% 10.40
        Round Off 0.40
        Net Amount 437.00
      `),
    )
    expect(r.items.map((i) => [i.name, i.qty, i.unitPaise, i.totalPaise])).toEqual([
      ['Paneer Tikka', 2, 18000, 36000],
      ['Butter Naan', 2, 4000, 8000],
    ])
    expect(r.charges.map((c) => [c.kind, c.paise])).toEqual([
      ['discount', -4400],
      ['service', 1980],
      ['tax', 1040],
      ['tax', 1040],
      ['roundoff', 40],
    ])
    expect(r.subtotalPaise).toBe(44000)
    expect(r.totalPaise).toBe(43700)
    expect(checkTotal(r).difference).toBe(0)
  })

  it('reads OCR slips in keywords like T0TAL and C6ST', () => {
    const r = parseReceipt(ocr('Chai 20.00\nC6ST 0.50\nT0TAL 20.50'))
    expect(r.charges[0].kind).toBe('tax')
    expect(r.totalPaise).toBe(2050)
  })

  it('finds no items in a non-receipt and leaves the total empty', () => {
    const r = parseReceipt(ocr('Hello from Goa\nbest trip ever\n2026'))
    expect(r).toEqual({ items: [], charges: [], subtotalPaise: undefined, totalPaise: undefined })
  })

  it('works without a printed total', () => {
    const r = parseReceipt(ocr('Milk 1 L 64.00\nBread 45.00'))
    expect(r.totalPaise).toBeUndefined()
    expect(checkTotal(r)).toEqual({ calculated: 10900, printed: undefined, difference: 0 })
  })

  it('reports how far off the items are when a price was misread', () => {
    const r = parseReceipt(ocr('Pizza 400.00\nCoffee 128.00\nTotal 520.00'))
    expect(checkTotal(r).difference).toBe(800)
  })

  it('ignores "Total Qty" lines', () => {
    const r = parseReceipt(ocr('Samosa 2 15.00 30.00\nTotal Qty 2\nTotal 30.00'))
    expect(r.items).toHaveLength(1)
    expect(r.totalPaise).toBe(3000)
  })
})
