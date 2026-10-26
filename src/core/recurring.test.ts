import { describe, expect, it } from 'vitest'
import { dueCopies, nextDate, type Recurring } from './recurring'

const wifi: Recurring = {
  id: 'r1',
  every: 'month',
  next: '2026-08-31',
  template: { title: 'Wi-Fi recharge', amountPaise: 99900, paidBy: { riya: 99900 }, split: { mode: 'equal', members: ['riya', 'arjun'] } },
}

describe('recurring expenses', () => {
  it('steps weeks and months, clamping to short months', () => {
    expect(nextDate('2026-12-29', 'week')).toBe('2027-01-05')
    expect(nextDate('2026-01-31', 'month')).toBe('2026-02-28')
    expect(nextDate('2026-02-28', 'month', 31)).toBe('2026-03-31')
    expect(nextDate('2026-12-15', 'month')).toBe('2027-01-15')
  })

  it('adds every copy that came due, then moves the rule on', () => {
    let n = 0
    const { copies, rules } = dueCopies([wifi], '2026-10-27', () => `e${++n}`)
    expect(copies.map((c) => c.date)).toEqual(['2026-08-31', '2026-09-30', '2026-10-31'].filter((d) => d <= '2026-10-27'))
    expect(copies[0]).toMatchObject({ id: 'e1', title: 'Wi-Fi recharge', recurringId: 'r1' })
    expect(rules[0].next).toBe('2026-10-31')
  })

  it('adds nothing before the due date', () => {
    expect(dueCopies([{ ...wifi, next: '2026-11-01' }], '2026-10-27', () => 'x').copies).toEqual([])
  })
})
