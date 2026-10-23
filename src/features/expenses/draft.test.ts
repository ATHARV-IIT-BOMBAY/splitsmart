import { describe, expect, it } from 'vitest'
import { draftFromExpense, draftToExpense, newDraft, remainingLabel } from './draft'

const ids = ['riya', 'arjun', 'meera']
const nameOf = (id: string) => id[0].toUpperCase() + id.slice(1)

describe('manual expense draft', () => {
  it('turns an equal split into a valid expense', () => {
    const draft = { ...newDraft(ids, 'riya'), title: 'Wi-Fi', amount: '100' }
    const { expense, problems } = draftToExpense(draft, 'e1', nameOf)
    expect(problems).toEqual([])
    expect(expense).toMatchObject({ amountPaise: 10000, paidBy: { riya: 10000 }, split: { mode: 'equal', members: ids } })
  })

  it('reads percentages as basis points and reports what’s missing', () => {
    const draft = { ...newDraft(ids, 'riya'), title: 'Cab', amount: '300', mode: 'percent' as const, values: { riya: '50', arjun: '25' } }
    expect(remainingLabel(draft)).toBe('75% of 100%')
    expect(draftToExpense(draft, 'e1', nameOf).problems).toEqual(['Percentages add up to 75%, not 100%.'])
  })

  it('names the person whose value is wrong', () => {
    const draft = { ...newDraft(ids, 'riya'), title: 'Cab', amount: '300', mode: 'shares' as const, values: { arjun: '1.5' } }
    expect(draftToExpense(draft, 'e1', nameOf).problems[0]).toBe('Check the value for Arjun.')
  })

  it('round-trips an exact split for editing', () => {
    const draft = { ...newDraft(ids, 'arjun'), title: 'Dinner', amount: '840', mode: 'exact' as const, values: { riya: '420', meera: '420' } }
    const { expense } = draftToExpense(draft, 'e1', nameOf)
    expect(draftFromExpense(expense, ids)).toMatchObject({ amount: '840', mode: 'exact', payer: 'arjun', values: { riya: '420', meera: '420' } })
  })
})
