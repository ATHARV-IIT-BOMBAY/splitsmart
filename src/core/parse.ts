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
const DIGIT_LOOKALIKES: Record<string, string> = { O: '0', o: '0', D: '0', l: '1', I: '1', '|': '1', S: '5', B: '8', Z: '2', T: '7' }

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
  const priceShaped = /^[\dODolISBZT|,]+[.,][\dODolISBZT|]{2}$/.test(cleaned)
  if (digits === 0 || (digits < cleaned.replace(/[.,]/g, '').length / 2 && !priceShaped)) return null
  let fixed = cleaned.replace(/[ODolISBZT|]/g, (c) => DIGIT_LOOKALIKES[c] ?? c)
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
  [/gstin|gst\s*no|fssai|phone|ph\b|mob|tel\b|invoice|bill\s*no|check\s*no|order|table|kot\b|cashier|waiter|steward|date|time|hsn|sac\b|thank|visit|cin\b|pan\b|upi|card|cash\b|ext\b|change\b|tender|paid\b|deliver(ed|y)\s*(on|by|address)|address|road|floor|shop\s*no|property|plot|place\s*of\s*supply|kms\b|survey|in\s*words|settled|taxable/, 'noise'],
  [/total\s*(qty|quantity|items?)|no\.?\s*of\s*items|items?\s*count/, 'noise'],
  [/sub\s*-?\s*tota?l?\b|item\s*(\(s\))?\s*total|food\s*total|gross/, 'subtotal'],
  [/payable|net\b/, 'grandTotal'],
  [/round\s*(ing|ed)?\s*off|r\/?\s*off|round/, 'roundoff'],
  [/service\s*(charge|chg|tax)?|\bs\.?\s*c\.?\b/, 'service'],
  [/packing|packaging|container|delivery|parcel/, 'delivery'],
  [/platform\s*fee|convenience|handling/, 'other'],
  [/c\.?\s*gst|s\.?\s*gst|i\.?\s*gst|u\.?\s*gst|\bgst\b|\b[cs]\.?st\b|\bvat\b|cess|\btax(es)?\b|@\s*[\d.lo]+\s*%/, 'tax'],
  [/\btotal\b|\bamount\b|\bamt\b/, 'total'],
]

/** Normalises common OCR slips in keywords: "T0TAL" → "total", "C6ST" → "cgst". */
function keywordText(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/(?<=[a-z])1|1(?=[a-z])/g, 'l')
    .replace(/[c6][g6][s5$]t/g, 'cgst')
    .replace(/[s5$][g6][s5$]t/g, 'sgst')
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
  return t === '' || !/[a-z0-9]/i.test(t) || CONNECTOR.test(t) || /^[+-]?\d+([.,]\d+)?%?$/.test(t) || readAmount(t, rupeeAsThree) !== null
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

type TotalLine = { kind: 'subtotal' | 'total' | 'grandTotal'; paise: Paise; at: number }

/**
 * Picks the subtotal and the total from every total-looking line:
 * - subtotal: a "Sub Total"-style line before any tax or charge, or a line
 *   equal to the items' sum;
 * - total: of the lines after the last charge, the one closest to items +
 *   charges (OCR may misread one of them, e.g. "3240" as "8240"), but a final
 *   rounded total within ₹1 of it wins.
 */
function pickTotals(lines: TotalLine[], itemsSum: Paise, charges: ParsedCharge[], chargeAt: number[]) {
  const firstCharge = chargeAt[0] ?? Infinity
  const lastCharge = chargeAt.at(-1) ?? -1
  const before = lines.filter((t) => t.at < firstCharge)
  const subtotal =
    before.filter((t) => t.kind === 'subtotal').at(-1) ??
    before.find((t) => t.paise === itemsSum) ??
    (charges.length > 0 ? before.filter((t) => t.kind !== 'grandTotal').at(-1) : undefined)

  const after = lines.filter((t) => t !== subtotal && t.at > lastCharge)
  let total: TotalLine | undefined
  if (after.length > 0) {
    const expected = itemsSum + charges.reduce((sum, c) => sum + c.paise, 0)
    const closest = after.reduce((a, b) => (Math.abs(b.paise - expected) < Math.abs(a.paise - expected) ? b : a))
    const last = after.at(-1)!
    total = Math.abs(last.paise - closest.paise) <= 100 ? last : closest
  }
  // Grocery invoices often print only "Item Total" with nothing added on top
  const totalPaise = total?.paise ?? (charges.length === 0 ? subtotal?.paise : undefined)
  return { subtotalPaise: subtotal?.paise, totalPaise }
}

function parseLines(lines: readonly OcrLine[], rupeeAsThree: boolean): ParsedReceipt {
  const items: ParsedItem[] = []
  const charges: ParsedCharge[] = []
  const chargeAt: number[] = []
  const totals: TotalLine[] = []

  lines.forEach((line, at) => {
    const words = line.words.filter((w) => w.text.trim())
    // The price is the last real word on the line. Anything after it other than
    // stray symbols ("FREE", "HELP", "kms") means this line has no price.
    let amountIndex = words.length - 1
    while (amountIndex >= 0 && !/[a-z0-9]/i.test(words[amountIndex].text)) amountIndex--
    if (amountIndex <= 0) return
    let raw = words[amountIndex].text

    // OCR sometimes splits "253.00" into "253," and "00"
    const prev = words[amountIndex - 1]?.text ?? ''
    const totalish = (k: LineKind | null) => k === 'subtotal' || k === 'total' || k === 'grandTotal'
    if (
      amountIndex >= 2 &&
      /^\d{2}$/.test(raw) &&
      (/^\d+[.,]$/.test(prev) ||
        (/^\d+$/.test(prev) && totalish(classify(words.slice(0, amountIndex - 1).map((w) => w.text).join(' ')))))
    ) {
      raw = `${prev.replace(/[.,]$/, '')}.${raw}`
      amountIndex--
    }

    // "(450 ml)", "(52.9 g": pack sizes in brackets, not prices
    if (raw.startsWith('(')) return
    const paise = readAmount(raw, rupeeAsThree)
    if (paise === null) return

    const labelTokens = words.slice(0, amountIndex).map((w) => w.text)
    const kind = classify(labelTokens.join(' '))
    const doubtful = isDoubtful(words.slice(amountIndex))
    const negative = isNegative(raw)

    if (kind === 'noise') return
    if (kind === 'subtotal' || kind === 'total' || kind === 'grandTotal') totals.push({ kind, paise, at })
    else if (kind) {
      const minus = negative || kind === 'discount' || (kind === 'roundoff' && /-\s*$|\(-/.test(line.text))
      charges.push({ label: chargeLabel(labelTokens, rupeeAsThree), kind, paise: minus ? -paise : paise, bbox: line.bbox, doubtful })
      chargeAt.push(at)
    } else {
      // Whole numbers under ₹10 without paise are almost always a quantity or row number
      if (!/[.,]\d{2}$/.test(stripJunk(raw)) && paise < 1000) return
      const item = parseItem(words, amountIndex, paise, line.bbox, rupeeAsThree)
      if (item) items.push(item)
    }
  })

  const itemsSum = items.reduce((sum, i) => sum + i.totalPaise, 0)
  return { items, charges, ...pickTotals(totals, itemsSum, charges, chargeAt) }
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
  // No single line can cost more than the whole bill before discounts: "229.00" read as "22900"
  const limit = Math.max(r.totalPaise, r.subtotalPaise ?? 0)
  const tooBig = (paise: Paise) => Math.abs(paise) > limit && paise % 100 === 0 && Math.abs(paise) / 100 <= limit
  r = {
    ...r,
    items: r.items.map((i) =>
      tooBig(i.totalPaise)
        ? { ...i, totalPaise: i.totalPaise / 100, unitPaise: i.unitPaise && i.unitPaise / 100, doubtfulAmount: true }
        : i,
    ),
    charges: r.charges.map((c) => (tooBig(c.paise) ? { ...c, paise: c.paise / 100, doubtful: true } : c)),
  }
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

/** Bills are often rounded to the rupee without printing a round-off line. */
function addRoundOff(r: ParsedReceipt): ParsedReceipt {
  const { difference } = checkTotal(r)
  if (difference === 0 || Math.abs(difference) > 100 || r.charges.some((c) => c.kind === 'roundoff')) return r
  const last = r.charges.at(-1) ?? r.items.at(-1)
  if (!last) return r
  return { ...r, charges: [...r.charges, { label: 'Round off', kind: 'roundoff', paise: -difference, bbox: last.bbox, doubtful: false }] }
}

export function parseReceipt(lines: readonly OcrLine[]): ParsedReceipt {
  const plain = parseLines(lines, false)
  if (addsUp(plain)) return plain
  // Try reading a leading "3" as a misread ₹ sign, and keep it only if the numbers then add up
  const rupee = parseLines(lines, true)
  return addRoundOff(restoreDecimals(addsUp(rupee) ? rupee : plain))
}

/**
 * The shop's name, if the top of the receipt prints it clearly: a short line of
 * confidently read words with no numbers, like "NIGHT CANTEEN" → "Night Canteen".
 * Single words are skipped (a cut-off "LMOHAR" reads confidently too), and only the
 * first real line counts, so an address line is never mistaken for the name.
 * Returns undefined rather than guessing from a garbled line.
 */
export function shopName(lines: readonly OcrLine[]): string | undefined {
  for (const line of lines.slice(0, 3)) {
    // "TAX INVOICE" or "Welcome" above the name is fine to skip; anything else is the name or nothing
    if (/invoice|receipt|welcome|original|copy/i.test(line.text)) continue
    const words = line.words.map((w) => ({ ...w, text: stripJunk(w.text) })).filter((w) => w.text)
    const text = words.map((w) => w.text).join(' ')
    const clear =
      words.length >= 2 &&
      words.length <= 4 &&
      !/[\d,]/.test(line.text) && // numbers or commas mean an address or a bill line
      classify(text) === null &&
      words.every((w) => w.confidence >= 85 && /^[a-z&'.-]+$/i.test(w.text))
    return clear ? text.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase()) : undefined
  }
  return undefined
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
