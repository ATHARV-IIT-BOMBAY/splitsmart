import { describe, expect, it } from 'vitest'
import { spending } from './spending'
import type { Group } from './types'

const group: Group = {
  id: 'g',
  name: 'Wing',
  members: [
    { id: 'a', name: 'Asha', color: '#f97316' },
    { id: 'b', name: 'Bilal', color: '#22c55e' },
    { id: 'c', name: 'Chen', color: '#3b82f6' },
  ],
  expenses: [
    { id: '1', title: 'Dinner', date: '2026-10-26', amountPaise: 10000, paidBy: { a: 10000 }, split: { mode: 'equal', members: ['a', 'b', 'c'] }, category: 'Food' },
    { id: '2', title: 'Cab', date: '2026-10-26', amountPaise: 30000, paidBy: { b: 30000 }, split: { mode: 'equal', members: ['a', 'b'] }, category: 'Travel' },
    { id: '3', title: 'Snacks', date: '2026-10-27', amountPaise: 5000, paidBy: { c: 5000 }, split: { mode: 'equal', members: ['c'] } },
  ],
  settlements: [],
}

describe('spending', () => {
  it('totals by category, biggest first, with no category as Other', () => {
    const s = spending(group)
    expect(s.total).toBe(45000)
    expect(s.byCategory).toEqual([['Travel', 30000], ['Food', 10000], ['Other', 5000]])
  })

  it("adds up each person's own shares, and they sum to the total", () => {
    const s = spending(group)
    expect(s.byPerson).toEqual([['a', 18334], ['b', 18333], ['c', 8333]])
    expect(s.byPerson.reduce((sum, [, p]) => sum + p, 0)).toBe(s.total)
  })
})
