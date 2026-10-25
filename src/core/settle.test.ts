import { describe, expect, it } from 'vitest'
import { computeBalances, directDebtCount } from './balances'
import { MAX_EXACT_PEOPLE, settleUp, type Transfer } from './settle'
import type { Expense, Group } from './types'

/** Applies transfers to balances; a correct settlement leaves everyone at 0. */
function afterPaying(balances: Record<string, number>, transfers: Transfer[]) {
  const left = { ...balances }
  for (const t of transfers) {
    expect(t.paise).toBeGreaterThan(0)
    left[t.from] += t.paise
    left[t.to] -= t.paise
  }
  return left
}

/**
 * Independent brute force (exhaustive backtracking) for the true minimum
 * number of payments, used to check settleUp on small random cases.
 */
function bruteForceMinimum(amounts: number[]): number {
  const debts = amounts.filter((a) => a !== 0)
  const search = (start: number): number => {
    while (start < debts.length && debts[start] === 0) start++
    if (start === debts.length) return 0
    let best = Infinity
    for (let i = start + 1; i < debts.length; i++) {
      if (debts[i] * debts[start] < 0) {
        debts[i] += debts[start]
        best = Math.min(best, 1 + search(start + 1))
        debts[i] -= debts[start]
      }
    }
    return best
  }
  return search(0)
}

describe('settleUp', () => {
  it('beats greedy: +600, +400, −300, −300, −400 settle in 3 payments, not 4', () => {
    const balances = { riya: 60000, arjun: 40000, meera: -30000, kabir: -30000, dev: -40000 }
    const transfers = settleUp(balances)
    expect(transfers).toHaveLength(3)
    expect(transfers).toContainEqual({ from: 'dev', to: 'arjun', paise: 40000 })
    expect(Object.values(afterPaying(balances, transfers)).every((b) => b === 0)).toBe(true)
  })

  it('A owes B ₹200 and B owes C ₹200 → A pays C directly', () => {
    expect(settleUp({ a: -20000, b: 0, c: 20000 })).toEqual([{ from: 'a', to: 'c', paise: 20000 }])
  })

  it('returns nothing when everyone is settled', () => {
    expect(settleUp({})).toEqual([])
    expect(settleUp({ a: 0, b: 0 })).toEqual([])
  })

  it('matches the brute-force minimum on 300 random groups', () => {
    for (let run = 0; run < 300; run++) {
      const n = 2 + Math.floor(Math.random() * 6)
      // small amounts so zero-sum subgroups (the hard case) happen often
      const amounts = Array.from({ length: n - 1 }, () => (Math.floor(Math.random() * 9) - 4) * 100)
      amounts.push(-amounts.reduce((a, b) => a + b, 0))
      const balances = Object.fromEntries(amounts.map((a, i) => [`m${i}`, a]))

      const transfers = settleUp(balances)
      expect(Object.values(afterPaying(balances, transfers)).every((b) => b === 0)).toBe(true)
      expect(transfers).toHaveLength(bruteForceMinimum(amounts))
    }
  })

  it('handles the largest exact size quickly and still settles beyond it', () => {
    for (const n of [MAX_EXACT_PEOPLE, MAX_EXACT_PEOPLE + 5]) {
      const amounts = Array.from({ length: n - 1 }, (_, i) => (i % 2 ? 1 : -1) * (i + 1) * 137)
      amounts.push(-amounts.reduce((a, b) => a + b, 0))
      const balances = Object.fromEntries(amounts.map((a, i) => [`m${i}`, a]))
      const transfers = settleUp(balances)
      expect(transfers.length).toBeLessThan(n)
      expect(Object.values(afterPaying(balances, transfers)).every((b) => b === 0)).toBe(true)
    }
  })
})

describe('computeBalances (5 members, 10 expenses, mixed payers)', () => {
  const ids = ['riya', 'arjun', 'meera', 'kabir', 'dev']
  const equal = (id: string, payer: string, amountPaise: number, members = ids): Expense => ({
    id,
    title: id,
    date: '2026-10-22',
    amountPaise,
    paidBy: { [payer]: amountPaise },
    split: { mode: 'equal', members },
  })
  const group: Group = {
    id: 'g',
    name: 'Wing B Goa Trip',
    members: ids.map((id) => ({ id, name: id, color: '#000' })),
    expenses: [
      equal('cab', 'riya', 150000),
      equal('dinner', 'arjun', 247550),
      equal('snacks', 'meera', 33333, ['meera', 'kabir', 'dev']),
      equal('beach', 'kabir', 100000),
      equal('fuel', 'dev', 80000, ['riya', 'dev']),
      equal('breakfast', 'riya', 64000, ['riya', 'arjun', 'meera']),
      equal('tickets', 'arjun', 250000),
      equal('water', 'meera', 9900),
      equal('lunch', 'kabir', 180000, ['arjun', 'kabir', 'dev']),
      equal('souvenir', 'dev', 45000, ['meera', 'dev']),
    ],
    settlements: [{ id: 's', from: 'meera', to: 'arjun', paise: 50000, date: '2026-10-23' }],
  }

  it('balances add up to zero and settle in the minimum number of payments', () => {
    const balances = computeBalances(group)
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(0)
    const transfers = settleUp(balances)
    expect(transfers).toHaveLength(bruteForceMinimum(Object.values(balances)))
    expect(Object.values(afterPaying(balances, transfers)).every((b) => b === 0)).toBe(true)
  })

  it('counts the IOUs people would have without simplifying', () => {
    expect(directDebtCount(group)).toBeGreaterThan(settleUp(computeBalances(group)).length)
    const twoWay: Group = {
      ...group,
      expenses: [equal('a', 'riya', 20000, ['riya', 'arjun']), equal('b', 'arjun', 30000, ['riya', 'arjun'])],
      settlements: [],
    }
    // Arjun owes Riya 100 and Riya owes Arjun 150: they cancel into one IOU
    expect(directDebtCount(twoWay)).toBe(1)
  })

  it('a recorded settlement reduces what is owed', () => {
    const before = computeBalances({ ...group, settlements: [] })
    const after = computeBalances(group)
    expect(after.meera - before.meera).toBe(50000)
    expect(after.arjun - before.arjun).toBe(-50000)
  })
})
