import type { Expense } from './types'

/** A bill that repeats, like a monthly Wi-Fi recharge or weekly water cans. */
export interface Recurring {
  id: string
  every: 'week' | 'month'
  /** Date (YYYY-MM-DD) the next copy is due. */
  next: string
  /** What each copy looks like; id and date are filled in per copy. */
  template: Omit<Expense, 'id' | 'date'>
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/**
 * The date one period after `date`. Months keep the day where they can and
 * clamp otherwise: 31 Jan → 28/29 Feb, but 28 Feb → 28 Mar.
 */
export function nextDate(date: string, every: Recurring['every'], anchorDay?: number): string {
  const [y, m, d] = date.split('-').map(Number)
  if (every === 'week') {
    const t = new Date(Date.UTC(y, m - 1, d + 7))
    return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
  }
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1]
  const daysInMonth = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return fmt(ny, nm, Math.min(anchorDay ?? d, daysInMonth))
}

/**
 * Every copy that has come due by `today` (catching up if the app wasn't
 * opened for a while), and the rules moved on to their next dates.
 */
export function dueCopies(rules: readonly Recurring[], today: string, newId: () => string) {
  const copies: Expense[] = []
  const updated = rules.map((rule) => {
    let next = rule.next
    const anchorDay = Number(rule.next.slice(8, 10))
    // Cap catch-up so a rule left alone for years can't flood the group
    for (let i = 0; next <= today && i < 60; i++) {
      copies.push({ ...rule.template, id: newId(), date: next, recurringId: rule.id })
      next = nextDate(next, rule.every, anchorDay)
    }
    return { ...rule, next }
  })
  return { copies, rules: updated }
}
