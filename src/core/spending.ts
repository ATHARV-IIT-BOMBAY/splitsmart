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
