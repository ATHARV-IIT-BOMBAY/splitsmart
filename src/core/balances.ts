import type { Paise } from './money'
import { computeShares } from './split'
import type { Group, MemberId } from './types'

/**
 * Net balance per member: positive means the group owes them,
 * negative means they owe the group. Balances always add up to 0.
 *
 * balance = paid for expenses − share of expenses
 *         + settlements paid − settlements received
 */
export function computeBalances(group: Group): Record<MemberId, Paise> {
  const memberOrder = group.members.map((m) => m.id)
  const balances: Record<MemberId, Paise> = Object.fromEntries(memberOrder.map((id) => [id, 0]))
  const add = (id: MemberId, paise: Paise) => {
    balances[id] = (balances[id] ?? 0) + paise
  }

  for (const expense of group.expenses) {
    for (const [id, paid] of Object.entries(expense.paidBy)) add(id, paid)
    for (const [id, share] of Object.entries(computeShares(expense, memberOrder))) add(id, -share)
  }
  for (const s of group.settlements) {
    add(s.from, s.paise)
    add(s.to, -s.paise)
  }
  return balances
}
