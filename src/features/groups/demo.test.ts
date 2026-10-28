import { describe, expect, it } from 'vitest'
import { computeBalances } from '../../core/balances'
import { settleUp } from '../../core/settle'
import { computeShares, validateExpense } from '../../core/split'
import { demoGroup } from './demo'

describe('demo group', () => {
  const group = demoGroup()
  const order = group.members.map((m) => m.id)

  it('every expense is valid and its shares add up to the bill', () => {
    for (const e of group.expenses) {
      expect(validateExpense(e)).toEqual([])
      expect(Object.values(computeShares(e, order)).reduce((a, b) => a + b, 0)).toBe(e.amountPaise)
    }
  })

  it('has 5 people, mixed payers and settles in at most 4 payments', () => {
    expect(group.members).toHaveLength(5)
    expect(new Set(group.expenses.map((e) => Object.keys(e.paidBy)[0])).size).toBe(5)
    expect(settleUp(computeBalances(group)).length).toBeLessThanOrEqual(4)
  })
})
