/**
 * Money is always stored as an integer number of paise (₹1 = 100 paise),
 * so adding and splitting amounts never hits floating-point errors.
 */
export type Paise = number

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

/** 123450 → "₹1,234.50" (Indian digit grouping). */
export function formatINR(paise: Paise): string {
  return inr.format(paise / 100)
}

/**
 * Parses what a user (or OCR) typed as rupees into paise.
 * Accepts "80", "80.5", "1,250.00", "₹ 80", "Rs. 80", "80/-".
 * Works on the string directly, so "0.29" is exactly 29 paise.
 * Returns null when the text isn't a valid amount.
 */
export function parseRupees(text: string): Paise | null {
  const cleaned = text
    .trim()
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/\/-$/, '')
    .replace(/,/g, '')
    .trim()
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const [, minus, rupees, fraction = ''] = match
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(paise)) return null
  return minus ? -paise : paise
}
