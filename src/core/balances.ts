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

/**
 * How many separate IOUs the group would have without simplifying: one for
 * every pair of people where one still owes the other directly (after the two
 * directions cancel out). Used to show "4 IOUs → 3 payments".
 */
export function directDebtCount(group: Group): number {
  const memberOrder = group.members.map((m) => m.id)
  const owed = new Map<string, number>() // "a|b" with a < b: positive means a owes b
  const add = (from: MemberId, to: MemberId, amount: number) => {
    if (from === to || amount === 0) return
    const [key, sign] = from < to ? [`${from}|${to}`, 1] : [`${to}|${from}`, -1]
    owed.set(key, (owed.get(key) ?? 0) + sign * amount)
  }
  for (const expense of group.expenses) {
    const total = expense.amountPaise
    for (const [debtor, share] of Object.entries(computeShares(expense, memberOrder))) {
      // With more than one payer, each person owes every payer in proportion to what they paid
      for (const [payer, paid] of Object.entries(expense.paidBy)) add(debtor, payer, (share * paid) / total)
    }
  }
  for (const s of group.settlements) add(s.to, s.from, s.paise)
  return [...owed.values()].filter((v) => Math.abs(v) >= 0.5).length
}
