import type { Paise } from './money'
import type { Category } from './types'

export const CATEGORIES: Category[] = ['Food', 'Groceries', 'Travel', 'Utilities', 'Entertainment', 'Other']

export const CATEGORY_EMOJI: Record<Category, string> = {
  Food: '🍔',
  Groceries: '🛒',
  Travel: '🛺',
  Utilities: '💡',
  Entertainment: '🎬',
  Other: '📦',
}

/**
 * What the zero-shot model is asked about each item: "This purchase is <label>."
 * Descriptive phrases work much better than bare category names. "Other" has
 * no phrase: it's what we pick when the model isn't confident about any.
 */
export const MODEL_LABELS: Record<string, Category> = {
  'food, a snack or a drink': 'Food',
  'groceries or household supplies': 'Groceries',
  'travel, transport, a cab or fuel': 'Travel',
  'a bill, rent, electricity, internet or phone recharge': 'Utilities',
  'entertainment, a movie, a game or an event': 'Entertainment',
}
export const HYPOTHESIS = 'This purchase is {}.'

/** Below this score the model is guessing, so the item goes to Other. */
const MIN_CONFIDENCE = 0.3

/** Turns the model's ranked labels into one category. */
export function pickCategory(labels: string[], scores: number[]): Category {
  if (!labels.length || scores[0] < MIN_CONFIDENCE) return 'Other'
  return MODEL_LABELS[labels[0]] ?? 'Other'
}

/** OCR names vary in case and spacing; "PNR  Tikka " and "pnr tikka" are the same item. */
export const itemKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** An expense's category is the one its items spent the most on. */
export function mainCategory(items: { category?: Category; totalPaise: Paise }[]): Category | undefined {
  const spend = new Map<Category, Paise>()
  for (const item of items) {
    if (item.category) spend.set(item.category, (spend.get(item.category) ?? 0) + item.totalPaise)
  }
  let best: Category | undefined
  for (const [category, paise] of spend) if (best === undefined || paise > spend.get(best)!) best = category
  return best
}

/**
 * Items on one receipt are usually the same kind of purchase, and the model
 * reads a whole list of names far better than a single cryptic one ("PNR
 * SEEKH KABAB"). When the whole-receipt answer agrees with the most common
 * item answer, it's used for every item; otherwise each item keeps its own.
 */
export function receiptCategories(perItem: Category[], wholeReceipt: Category): Category[] {
  const counts = new Map<Category, number>()
  for (const c of perItem) counts.set(c, (counts.get(c) ?? 0) + 1)
  const common = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  return common === wholeReceipt ? perItem.map(() => wholeReceipt) : perItem
}
