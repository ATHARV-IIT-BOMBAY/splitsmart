import { describe, expect, it } from 'vitest'
import { groupToCsv } from './csv'
import type { Group } from './types'

function makeGroup(title: string): Group {
  return {
    id: 'g1',
    name: 'Trip',
    meId: 'a',
    members: [
      { id: 'a', name: 'Asha', color: '#f97316' },
      { id: 'b', name: 'Bilal', color: '#22c55e' },
      { id: 'c', name: 'Chen, Jr.', color: '#3b82f6' },
    ],
    expenses: [
      {
        id: 'e1',
        title,
        date: '2026-10-26',
        amountPaise: 10000,
        paidBy: { a: 10000 },
        split: { mode: 'equal', members: ['a', 'b', 'c'] },
        category: 'Food',
      },
    ],
    settlements: [],
  }
}

describe('groupToCsv', () => {
  it('splits ₹100 three ways as 33.34, 33.33, 33.33', () => {
    const lines = groupToCsv(makeGroup('Dinner')).split('\r\n')
    expect(lines[1]).toBe('"2026-10-26","Dinner","Food","Asha","100.00","33.34","33.33","33.33"')
  })

  it('has the right header, with member names quoted', () => {
    const header = groupToCsv(makeGroup('Dinner')).split('\r\n')[0]
    expect(header).toBe('"Date","Description","Category","Paid by","Amount (₹)","Asha","Bilal","Chen, Jr."')
  })

  it('doubles quotes inside values', () => {
    expect(groupToCsv(makeGroup('The "big" dinner'))).toContain('"The ""big"" dinner"')
  })

  it('lists several payers together', () => {
    const group = makeGroup('Taxi')
    group.expenses[0].paidBy = { a: 6000, b: 4000 }
    expect(groupToCsv(group).split('\r\n')[1]).toContain('"Asha + Bilal"')
  })
})
