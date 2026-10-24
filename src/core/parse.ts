import { parseRupees, type Paise } from './money'
import type { Charge } from './types'

/*
 * Turns OCR output into receipt lines. Pure functions, no Tesseract types,
 * so it's easy to test with plain text.
 */

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrWord {
  text: string
  /** Tesseract confidence, 0–100. */
  confidence: number
  bbox: Box
}

export interface OcrLine {
  text: string
  words: OcrWord[]
  bbox: Box
}

/** Words Tesseract is less sure about than this get highlighted for review. */
export const LOW_CONFIDENCE = 70

export interface ParsedItem {
  name: string
  qty: number
  unitPaise?: Paise
  totalPaise: Paise
  /** Where the line sits on the photo, for crops and highlights. */
  bbox: Box
  doubtfulName: boolean
  doubtfulAmount: boolean
}

export interface ParsedCharge {
  label: string
  kind: Charge['kind']
  paise: Paise
  bbox: Box
  doubtful: boolean
}

export interface ParsedReceipt {
  items: ParsedItem[]
  charges: ParsedCharge[]
  subtotalPaise?: Paise
  totalPaise?: Paise
}

// OCR often reads digits as look-alike letters inside numbers.
const DIGIT_LOOKALIKES: Record<string, string> = { O: '0', o: '0', D: '0', l: '1', I: '1', '|': '1', S: '5', B: '8', Z: '2' }

/**
 * Reads one OCR token as money, fixing look-alike letters when the token is
 * clearly a number ("12O.00" → 12000 paise). Returns null for words, codes,
 * percentages and anything with too few digits.
 */
export function readAmount(token: string): Paise | null {
  const cleaned = token.replace(/^(₹|rs\.?|inr)/i, '').replace(/\/-$/, '').replace(/[:*]$/, '')
  if (!cleaned || /%/.test(cleaned)) return null
  const digits = (cleaned.match(/\d/g) ?? []).length
  // Mostly digits, or clearly price-shaped like "8O,OO" (two places after the point)
  const priceShaped = /^[\dODolISBZ|,]+[.,][\dODolISBZ|]{2}$/.test(cleaned)
  if (digits === 0 || (digits < cleaned.replace(/[.,]/g, '').length / 2 && !priceShaped)) return null
  let fixed = cleaned.replace(/[ODolISBZ|]/g, (c) => DIGIT_LOOKALIKES[c] ?? c)
  // "80,00" (comma as decimal point) → "80.00"; "1,250.00" stays as grouping
  if (/^\d+,\d{2}$/.test(fixed)) fixed = fixed.replace(',', '.')
  // Long whole numbers are PIN codes, phone or bill numbers, not prices
  if (/^\d{6,}$/.test(fixed) || /^0\d/.test(fixed)) return null
  const paise = parseRupees(fixed)
  return paise !== null && paise >= 0 ? paise : null
}

type LineKind = 'total' | 'grandTotal' | 'subtotal' | Charge['kind'] | 'noise'

// Order matters: the first matching rule wins.
const KEYWORDS: [RegExp, LineKind][] = [
  [/gstin|gst\s*no|fssai|phone|ph\b|mob|tel\b|invoice|bill\s*no|order\s*no|table|kot\b|cashier|waiter|steward|date|time|hsn|sac\b|thank|visit|cin\b|pan\b|upi|card|cash\b|change\b|tender|paid\b/, 'noise'],
  [/total\s*(qty|quantity|items?)|no\.?\s*of\s*items|items?\s*count/, 'noise'],
  [/sub\s*-?\s*total|item\s*total|food\s*total|gross/, 'subtotal'],
  [/grand\s*total|net\s*(amount|amt|total|payable)|bill\s*amount|amount\s*payable|payable|to\s*pay|net\b/, 'grandTotal'],
  [/round\s*(ing|ed)?\s*off|r\/?\s*off|round/, 'roundoff'],
  [/discount|disc\b|less\b|offer|coupon|savings?/, 'discount'],
  [/service\s*(charge|chg|tax)?|\bs\.?\s*c\.?\b/, 'service'],
  [/packing|packaging|container|delivery|parcel|convenience/, 'delivery'],
  [/c\.?\s*gst|s\.?\s*gst|i\.?\s*gst|u\.?\s*gst|\bgst\b|\bvat\b|cess|\btax\b/, 'tax'],
  [/\btotal\b|\bamount\b|\bamt\b/, 'total'],
]

/** Normalises common OCR slips in keywords: "T0TAL" → "total", "C6ST" → "cgst". */
function keywordText(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/(?<=[a-z])1|1(?=[a-z])/g, 'l')
    .replace(/c6st|cg5t/g, 'cgst')
    .replace(/s6st|sg5t/g, 'sgst')
}

function classify(label: string): LineKind | null {
  const text = keywordText(label)
  for (const [pattern, kind] of KEYWORDS) if (pattern.test(text)) return kind
  return null
}

const isDoubtful = (words: OcrWord[]) => words.some((w) => w.confidence < LOW_CONFIDENCE)

/** Small whole numbers in front of the price are usually quantities. */
const asQty = (token: string) => (/^\d{1,2}$/.test(token) && Number(token) > 0 ? Number(token) : null)

function parseItem(words: OcrWord[], amountIndex: number, totalPaise: Paise, bbox: Box): ParsedItem | null {
  const before = words.slice(0, amountIndex)
  const tokens = before.map((w) => w.text)

  // Peel numbers off the end of the name: "Maggi 3 60.00" or "Maggi 3 x 60".
  let qty = 1
  let unitPaise: Paise | undefined
  const trailing: string[] = []
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]
    if (/^(x|@|\*)$/i.test(last)) {
      tokens.pop()
      continue
    }
    if (readAmount(last) === null && !/^x\d{1,2}$/i.test(last)) break
    trailing.unshift(tokens.pop()!)
  }
  // "2 Masala Dosa 80.00" — a leading quantity
  if (tokens.length > 1 && asQty(tokens[0]) !== null) qty = asQty(tokens.shift()!)!

  const xQty = trailing.find((t) => /^x\d{1,2}$/i.test(t))
  if (xQty) qty = Number(xQty.slice(1))
  const numbers = trailing.filter((t) => t !== xQty)
  if (numbers.length >= 2) {
    // "qty rate" in either order; pick the reading where qty × rate = amount
    const [a, b] = numbers.slice(-2)
    const [qa, rb, qb, ra] = [asQty(a), readAmount(b), asQty(b), readAmount(a)]
    if (qa !== null && rb !== null) [qty, unitPaise] = [qa, rb]
    else if (qb !== null && ra !== null) [qty, unitPaise] = [qb, ra]
  } else if (numbers.length === 1) {
    const q = asQty(numbers[0])
    const rate = readAmount(numbers[0])
    if (q !== null && q * 100 !== totalPaise && totalPaise % q === 0) qty = q
    else if (rate !== null && rate > 0 && totalPaise % rate === 0) [qty, unitPaise] = [totalPaise / rate, rate]
  }
  if (unitPaise === undefined && qty > 1 && totalPaise % qty === 0) unitPaise = totalPaise / qty
  if (unitPaise === undefined) unitPaise = qty === 1 ? totalPaise : undefined

  const name = tokens
    .join(' ')
    .replace(/[.:\-–_=]+$/, '')
    .replace(/^[^a-z0-9]+/i, '')
    .trim()
  if (!/[a-z]{2}/i.test(name) || totalPaise === 0) return null
  return {
    name,
    qty,
    unitPaise,
    totalPaise,
    bbox,
    doubtfulName: isDoubtful(before),
    doubtfulAmount: isDoubtful(words.slice(amountIndex)),
  }
}

export function parseReceipt(lines: readonly OcrLine[]): ParsedReceipt {
  const items: ParsedItem[] = []
  const charges: ParsedCharge[] = []
  const totals: { kind: 'total' | 'grandTotal'; paise: Paise; at: number }[] = []
  let subtotalPaise: Paise | undefined

  lines.forEach((line, lineIndex) => {
    const words = line.words.filter((w) => w.text.trim())
    // The price is the right-most money-looking word on the line.
    let amountIndex = -1
    for (let i = words.length - 1; i >= 0; i--) {
      if (readAmount(words[i].text) !== null) {
        amountIndex = i
        break
      }
    }
    if (amountIndex <= 0) return
    const paise = readAmount(words[amountIndex].text)!
    const label = words
      .slice(0, amountIndex)
      .map((w) => w.text)
      .join(' ')
    const kind = classify(label)
    const doubtful = isDoubtful(words.slice(amountIndex))

    if (kind === 'noise') return
    if (kind === 'subtotal') subtotalPaise = paise
    else if (kind === 'total' || kind === 'grandTotal') totals.push({ kind, paise, at: lineIndex })
    else if (kind) {
      const negative = kind === 'discount' || (kind === 'roundoff' && /-\s*$|\(-|-\d/.test(line.text))
      charges.push({ label: label.replace(/[:\-–]+$/, '').trim(), kind, paise: negative ? -paise : paise, bbox: line.bbox, doubtful })
    } else {
      const item = parseItem(words, amountIndex, paise, line.bbox)
      if (item) items.push(item)
    }
  })

  // A plain "Total" before tax lines is really the subtotal; the grand total wins.
  const grand = totals.filter((t) => t.kind === 'grandTotal').at(-1) ?? totals.at(-1)
  for (const t of totals) {
    if (t !== grand && subtotalPaise === undefined) subtotalPaise = t.paise
  }
  return { items, charges, subtotalPaise, totalPaise: grand?.paise }
}

/** Items + charges, and how far that is from the printed total. */
export function checkTotal(receipt: Pick<ParsedReceipt, 'items' | 'charges' | 'totalPaise'>) {
  const calculated =
    receipt.items.reduce((sum, i) => sum + i.totalPaise, 0) + receipt.charges.reduce((sum, c) => sum + c.paise, 0)
  return {
    calculated,
    printed: receipt.totalPaise,
    difference: receipt.totalPaise === undefined ? 0 : calculated - receipt.totalPaise,
  }
}
