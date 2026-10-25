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

/** Table borders, brackets and stray punctuation OCR glues onto words. */
const stripJunk = (token: string) => token.replace(/^[|[\](){}<>«»“”"'`]+|[|[\](){}<>«»“”"'`,;:.]+$/g, '')

const isNegative = (token: string) => /^[-−–]/.test(token.trim())

/**
 * Reads one OCR token as money, fixing look-alike letters when the token is
 * clearly a number ("12O.00" → 12000 paise). Returns null for words, codes,
 * percentages and anything with too few digits. The sign is ignored; check
 * isNegative() for discounts like "-70".
 *
 * `rupeeAsThree`: Tesseract's English model has no "₹", so "₹235" often
 * comes out as "3235". When set, a leading 3 on a whole number is dropped.
 */
export function readAmount(token: string, rupeeAsThree = false): Paise | null {
  let cleaned = stripJunk(token)
    .replace(/^[-−–]/, '')
    .replace(/^(₹|rs\.?|inr|%)(?=\d)/i, '')
    .replace(/\/-$/, '')
    .replace(/[*]$/, '')
  if (!cleaned || /%/.test(cleaned)) return null
  if (rupeeAsThree && /^3\d{2,}$/.test(cleaned)) cleaned = cleaned.slice(1)
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
  [/grand\s*total|bill\s*total|net\s*(amount|amt|total|payable)|bill\s*amount|amount\s*payable|invoice\s*(value|total|amount)|total\s*(value|amount|payable|due)|to\s*pay\b/, 'grandTotal'],
  [/discount|disc\b|\bless\b|offer|coupon|savings?/, 'discount'],
  [/gstin|gst\s*no|fssai|phone|ph\b|mob|tel\b|invoice|bill\s*no|order|table|kot\b|cashier|waiter|steward|date|time|hsn|sac\b|thank|visit|cin\b|pan\b|upi|card|cash\b|change\b|tender|paid\b|deliver(ed|y)\s*(on|by|address)|address|road|floor|shop\s*no|property|plot|place\s*of\s*supply|kms\b|survey|in\s*words|settled|taxable/, 'noise'],
  [/total\s*(qty|quantity|items?)|no\.?\s*of\s*items|items?\s*count/, 'noise'],
  [/sub\s*-?\s*total|item\s*(\(s\))?\s*total|food\s*total|gross/, 'subtotal'],
  [/payable|net\b/, 'grandTotal'],
  [/round\s*(ing|ed)?\s*off|r\/?\s*off|round/, 'roundoff'],
  [/service\s*(charge|chg|tax)?|\bs\.?\s*c\.?\b/, 'service'],
  [/packing|packaging|container|delivery|parcel/, 'delivery'],
  [/platform\s*fee|convenience|handling/, 'other'],
  [/c\.?\s*gst|s\.?\s*gst|i\.?\s*gst|u\.?\s*gst|\bgst\b|\bvat\b|cess|\btax(es)?\b/, 'tax'],
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

/** Small whole numbers are usually quantities. */
const asQty = (token: string) => (/^\d{1,2}$/.test(token) && Number(token) > 0 ? Number(token) : null)

const CONNECTOR = /^[x×@*=+\-–—]$/i

/** Numbers, percentages, "x"/"@" and leftover junk: the columns after an item's name. */
const isNumberish = (token: string, rupeeAsThree: boolean) => {
  const t = stripJunk(token)
  return t === '' || CONNECTOR.test(t) || /^[+-]?\d+([.,]\d+)?%?$/.test(t) || readAmount(t, rupeeAsThree) !== null
}

/**
 * Splits the words before the price into a name and the number columns after
 * it: "McVeggie Burger Combo 385.23 192.62 2.50%" → name + numbers.
 */
function splitName(tokens: string[], rupeeAsThree: boolean): { name: string[]; rest: string[] } {
  let cut = tokens.length
  while (cut > 0 && isNumberish(tokens[cut - 1], rupeeAsThree)) cut--
  return { name: tokens.slice(0, cut), rest: tokens.slice(cut).map(stripJunk).filter(Boolean) }
}

function parseItem(
  words: OcrWord[],
  amountIndex: number,
  totalPaise: Paise,
  bbox: Box,
  rupeeAsThree: boolean,
): ParsedItem | null {
  const before = words.slice(0, amountIndex)
  const tokens = before.map((w) => stripJunk(w.text)).filter(Boolean)
  let qty = 1
  let unitPaise: Paise | undefined

  // Leading quantity: "2 Masala Dosa", "1 x Burger", "1x Burger", OCR's "Tx Burger"
  const lead = /^(\d{1,2})x$/i.exec(tokens[0] ?? '')
  if (lead) {
    qty = Number(lead[1])
    tokens.shift()
  } else if (/^[tli1]?x$/i.test(tokens[0] ?? '') && tokens.length > 1) {
    tokens.shift()
  } else if (tokens.length > 1 && asQty(tokens[0]) !== null && !isNumberish(tokens[1], rupeeAsThree)) {
    qty = asQty(tokens.shift()!)!
    if (/^[x×*]$/i.test(tokens[0] ?? '')) tokens.shift()
  } else if (tokens.length > 2 && asQty(tokens[0]) !== null && /^[x×*]$/i.test(tokens[1])) {
    qty = asQty(tokens[0])!
    tokens.splice(0, 2)
  }

  const leadingPlainNumber = qty > 1 && !lead && !/^[x×*]$/i.test(before[1]?.text ?? '')
  const { name, rest } = splitName(tokens, rupeeAsThree)
  // In wide invoice tables the first number is a row number, not a quantity
  if (leadingPlainNumber && rest.filter((t) => !CONNECTOR.test(t)).length >= 4) qty = 1
  const x = rest.findIndex((t) => /^[x×@*]$/i.test(t))
  const numbers = rest.filter((t) => !CONNECTOR.test(t))
  if (x >= 0) {
    // "2 x 180.00" (qty × rate) or "x 1" (just a quantity)
    const after = rest[x + 1]
    const beforeX = x > 0 ? rest[x - 1] : undefined
    if (beforeX && asQty(beforeX) !== null && after && readAmount(after) !== null) [qty, unitPaise] = [asQty(beforeX)!, readAmount(after)!]
    else if (after && asQty(after) !== null) qty = asQty(after)!
  } else if (numbers.length === 2) {
    // "qty rate" in either order; pick the reading where qty × rate = amount
    const [a, b] = numbers
    const [qa, rb, qb, ra] = [asQty(a), readAmount(b, rupeeAsThree), asQty(b), readAmount(a, rupeeAsThree)]
    if (qa !== null && rb !== null && qa * rb === totalPaise) [qty, unitPaise] = [qa, rb]
    else if (qb !== null && ra !== null && qb * ra === totalPaise) [qty, unitPaise] = [qb, ra]
    else if (qa !== null && rb !== null) [qty, unitPaise] = [qa, rb]
  } else if (numbers.length === 1) {
    const q = asQty(numbers[0])
    const rate = readAmount(numbers[0], rupeeAsThree)
    if (q !== null && q * 100 !== totalPaise && totalPaise % q === 0) qty = q
    else if (rate !== null && rate > 0 && totalPaise % rate === 0) [qty, unitPaise] = [totalPaise / rate, rate]
  }
  // Wider tables (MRP, discount, GST columns…) are ignored: the last column is the line total
  if (unitPaise === undefined && qty > 1 && totalPaise % qty === 0) unitPaise = totalPaise / qty
  if (unitPaise === undefined) unitPaise = qty === 1 ? totalPaise : undefined

  const cleanName = name
    .filter((t) => /[a-z]/i.test(t))
    .join(' ')
    .replace(/[.:\-–_=]+$/, '')
    .replace(/^[^a-z0-9]+/i, '')
    .trim()
  if (!/[a-z]{2}/i.test(cleanName) || totalPaise === 0) return null
  return {
    name: cleanName,
    qty,
    unitPaise,
    totalPaise,
    bbox,
    doubtfulName: isDoubtful(before),
    doubtfulAmount: isDoubtful(words.slice(amountIndex)),
  }
}

/** Charge labels keep a rate like "CGST @ 2.5%" but drop table columns. */
function chargeLabel(tokens: string[], rupeeAsThree: boolean): string {
  const { name, rest } = splitName(tokens, rupeeAsThree)
  const label = [...name]
  if (rest[0] === '@' || /%$/.test(rest[0] ?? '')) {
    for (const t of rest) {
      label.push(t)
      if (/%$/.test(t)) break
    }
  }
  return label.join(' ').replace(/[:\-–]+$/, '').trim()
}

function parseLines(lines: readonly OcrLine[], rupeeAsThree: boolean): ParsedReceipt {
  const items: ParsedItem[] = []
  const charges: ParsedCharge[] = []
  const totals: { kind: 'total' | 'grandTotal'; paise: Paise }[] = []
  let subtotalPaise: Paise | undefined

  for (const line of lines) {
    const words = line.words.filter((w) => w.text.trim())
    // The price is the last real word on the line. Anything after it other than
    // stray symbols ("FREE", "HELP", "kms") means this line has no price.
    let amountIndex = words.length - 1
    while (amountIndex >= 0 && !/[a-z0-9]/i.test(words[amountIndex].text)) amountIndex--
    if (amountIndex <= 0) continue
    const raw = words[amountIndex].text
    // "(450 ml)", "(52.9 g": pack sizes in brackets, not prices
    if (raw.startsWith('(')) continue
    const paise = readAmount(raw, rupeeAsThree)
    if (paise === null) continue

    const labelTokens = words.slice(0, amountIndex).map((w) => w.text)
    const kind = classify(labelTokens.join(' '))
    const doubtful = isDoubtful(words.slice(amountIndex))
    const negative = isNegative(raw)

    if (kind === 'noise') continue
    if (kind === 'subtotal') subtotalPaise = paise
    else if (kind === 'total' || kind === 'grandTotal') totals.push({ kind, paise })
    else if (kind) {
      const minus = negative || kind === 'discount' || (kind === 'roundoff' && /-\s*$|\(-/.test(line.text))
      charges.push({ label: chargeLabel(labelTokens, rupeeAsThree), kind, paise: minus ? -paise : paise, bbox: line.bbox, doubtful })
    } else {
      // Whole numbers under ₹10 without paise are almost always a quantity or row number
      if (!/[.,]\d{2}$/.test(stripJunk(raw)) && paise < 1000) continue
      const item = parseItem(words, amountIndex, paise, line.bbox, rupeeAsThree)
      if (item) items.push(item)
    }
  }

  // A plain "Total" before the grand total is really the subtotal; the grand total wins.
  const grand = totals.filter((t) => t.kind === 'grandTotal').at(-1) ?? totals.at(-1)
  for (const t of totals) {
    if (t !== grand && subtotalPaise === undefined) subtotalPaise = t.paise
  }
  // Grocery invoices often print only "Item Total" with nothing added on top
  const totalPaise = grand?.paise ?? (charges.length === 0 ? subtotalPaise : undefined)
  return { items, charges, subtotalPaise, totalPaise }
}

/** True when the items or the whole bill add up to what the receipt printed. */
function addsUp(r: ParsedReceipt): boolean {
  const items = r.items.reduce((sum, i) => sum + i.totalPaise, 0)
  return (r.items.length > 0 && items === r.subtotalPaise) || (r.totalPaise !== undefined && checkTotal(r).difference === 0)
}

/**
 * OCR sometimes drops the decimal point: "₹19.05" becomes "1905". If putting
 * the point back into doubtful whole-number charges brings the bill within ₹1
 * of the printed total, do it. They stay highlighted for the user to check.
 */
function restoreDecimals(r: ParsedReceipt): ParsedReceipt {
  if (r.totalPaise === undefined) return r
  const suspects = r.charges.filter((c) => c.doubtful && Math.abs(c.paise) >= 100000 && c.paise % 100 === 0)
  if (suspects.length === 0 || suspects.length > 6) return r
  let best = r
  let bestGap = Math.abs(checkTotal(r).difference)
  for (let mask = 1; mask < 1 << suspects.length; mask++) {
    const fixed = new Set(suspects.filter((_, i) => mask & (1 << i)))
    const candidate = { ...r, charges: r.charges.map((c) => (fixed.has(c) ? { ...c, paise: c.paise / 100 } : c)) }
    const gap = Math.abs(checkTotal(candidate).difference)
    if (gap < bestGap) [best, bestGap] = [candidate, gap]
  }
  return bestGap <= 100 ? best : r
}

export function parseReceipt(lines: readonly OcrLine[]): ParsedReceipt {
  const plain = parseLines(lines, false)
  if (addsUp(plain)) return plain
  // Try reading a leading "3" as a misread ₹ sign, and keep it only if the numbers then add up
  const rupee = parseLines(lines, true)
  return restoreDecimals(addsUp(rupee) ? rupee : plain)
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
