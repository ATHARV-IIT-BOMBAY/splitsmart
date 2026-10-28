import type { Paise } from './money'
import { computeShares } from './split'
import type { Category, Group, MemberId } from './types'

export interface Spending {
  total: Paise
  /** Biggest first; expenses with no category count as Other. */
  byCategory: [Category, Paise][]
  /** What each person's own share added up to, biggest first. */
  byPerson: [MemberId, Paise][]
}

const biggestFirst = <K>(totals: Map<K, Paise>) =>
  [...totals].filter(([, paise]) => paise > 0).sort((a, b) => b[1] - a[1])

export function spending(group: Group): Spending {
  const memberIds = group.members.map((m) => m.id)
  const byCategory = new Map<Category, Paise>()
  const byPerson = new Map<MemberId, Paise>()
  let total = 0

  for (const expense of group.expenses) {
    total += expense.amountPaise
    const category = expense.category ?? 'Other'
    byCategory.set(category, (byCategory.get(category) ?? 0) + expense.amountPaise)
    for (const [id, paise] of Object.entries(computeShares(expense, memberIds))) {
      byPerson.set(id, (byPerson.get(id) ?? 0) + paise)
    }
  }
  return { total, byCategory: biggestFirst(byCategory), byPerson: biggestFirst(byPerson) }
}

export interface Period {
  /** First day of the period, YYYY-MM-DD. */
  start: string
  label: string
  paise: Paise
}

const DAY = 86_400_000
const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`)
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10)
const short = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })

/**
 * Spending over time, with no gaps: by day for a trip of up to two weeks, by
 * week (from Monday) up to about four months, by month beyond that.
 */
export function spendingOverTime(group: Group): { unit: 'day' | 'week' | 'month'; periods: Period[] } {
  const dated = group.expenses.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
  if (dated.length === 0) return { unit: 'day', periods: [] }
  const times = dated.map((e) => toTime(e.date))
  const [first, last] = [Math.min(...times), Math.max(...times)]
  const span = (last - first) / DAY
  const unit = span < 14 ? 'day' : span <= 120 ? 'week' : 'month'

  const startOf = (time: number) => {
    const d = new Date(time)
    if (unit === 'week') return time - ((d.getUTCDay() + 6) % 7) * DAY
    if (unit === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    return time
  }
  const after = (time: number) => {
    const d = new Date(time)
    if (unit === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    return time + (unit === 'week' ? 7 : 1) * DAY
  }

  const totals = new Map<number, Paise>()
  dated.forEach((e, i) => {
    const key = startOf(times[i])
    totals.set(key, (totals.get(key) ?? 0) + e.amountPaise)
  })
  const periods: Period[] = []
  for (let t = startOf(first); t <= last; t = after(t)) {
    const label = unit === 'month' ? monthName.format(t) : unit === 'week' ? `w/c ${short.format(t)}` : short.format(t)
    periods.push({ start: toDate(t), label, paise: totals.get(t) ?? 0 })
  }
  return { unit, periods }
}
