import { describe, expect, it } from 'vitest'
import { computeShares, validateExpense } from './split'
import type { Expense, Split } from './types'

const members = ['riya', 'arjun', 'meera', 'kabir']

function expense(split: Split, amountPaise: number, payer = 'riya'): Expense {
  return { id: 'e1', title: 'Test', date: '2026-10-22', amountPaise, paidBy: { [payer]: amountPaise }, split }
}

const total = (shares: Record<string, number>) => Object.values(shares).reduce((a, b) => a + b, 0)

describe('equal split', () => {
  it('₹100 three ways: the payer absorbs the extra paisa', () => {
    const e = expense({ mode: 'equal', members: ['arjun', 'meera', 'kabir'] }, 10000, 'meera')
    expect(computeShares(e, members)).toEqual({ arjun: 3333, meera: 3334, kabir: 3333 })
  })

  it('when the payer is not in the split, join order breaks ties', () => {
    const e = expense({ mode: 'equal', members: ['arjun', 'meera', 'kabir'] }, 10000, 'riya')
    expect(computeShares(e, members)).toEqual({ arjun: 3334, meera: 3333, kabir: 3333 })
  })
})

describe('exact, percent and shares splits', () => {
  it('exact amounts are used as entered', () => {
    const e = expense({ mode: 'exact', amounts: { riya: 7000, arjun: 3000 } }, 10000)
    expect(computeShares(e, members)).toEqual({ riya: 7000, arjun: 3000 })
    expect(validateExpense(e)).toEqual([])
  })

  it('percentages split the bill and must total 100%', () => {
    const e = expense({ mode: 'percent', basisPoints: { riya: 5000, arjun: 2500, meera: 2500 } }, 84000)
    expect(computeShares(e, members)).toEqual({ riya: 42000, arjun: 21000, meera: 21000 })
    expect(validateExpense(e)).toEqual([])

    const bad = expense({ mode: 'percent', basisPoints: { riya: 5000, arjun: 4500 } }, 84000)
    expect(validateExpense(bad)).toEqual(['Percentages add up to 95%, not 100%.'])
  })

  it('shares 2:1:1', () => {
    const e = expense({ mode: 'shares', shares: { riya: 2, arjun: 1, meera: 1 } }, 10000)
    expect(computeShares(e, members)).toEqual({ riya: 5000, arjun: 2500, meera: 2500 })
  })

  it('exact amounts must add up to the bill', () => {
    const short = expense({ mode: 'exact', amounts: { riya: 5000, arjun: 3000 } }, 10000)
    expect(validateExpense(short)).toEqual(['₹20.00 still to assign.'])
    const over = expense({ mode: 'exact', amounts: { riya: 8000, arjun: 3000 } }, 10000)
    expect(validateExpense(over)).toEqual(['₹10.00 more than the bill.'])
  })
})

describe('itemized split (the judges’ ₹840 night canteen bill)', () => {
  const canteen = expense(
    {
      mode: 'itemized',
      items: [
        { id: 'pizza', name: 'Large pizza', qty: 1, totalPaise: 40000, assignees: members },
        { id: 'm1', name: 'Maggi', qty: 1, totalPaise: 6000, assignees: ['riya'] },
        { id: 'm2', name: 'Maggi', qty: 1, totalPaise: 6000, assignees: ['arjun'] },
        { id: 'm3', name: 'Maggi', qty: 1, totalPaise: 6000, assignees: ['kabir'] },
        { id: 'coffee', name: 'Cold coffee', qty: 1, totalPaise: 12000, assignees: ['meera'] },
        { id: 'bread', name: 'Garlic bread', qty: 1, totalPaise: 10000, assignees: ['riya', 'meera'] },
      ],
      charges: [
        { id: 'cgst', label: 'CGST 2.5%', kind: 'tax', paise: 2000 },
        { id: 'sgst', label: 'SGST 2.5%', kind: 'tax', paise: 2000 },
      ],
    },
    84000,
  )

  it('splits GST in proportion to what each person ate', () => {
    expect(computeShares(canteen, members)).toEqual({ riya: 22050, arjun: 16800, meera: 28350, kabir: 16800 })
    expect(validateExpense(canteen)).toEqual([])
  })

  it('spreads a discount proportionally and still adds up exactly', () => {
    const split = canteen.split as Extract<Split, { mode: 'itemized' }>
    const withDiscount = expense(
      { ...split, charges: [...split.charges, { id: 'd', label: 'Discount', kind: 'discount', paise: -10001 }] },
      73999,
    )
    expect(validateExpense(withDiscount)).toEqual([])
    expect(total(computeShares(withDiscount, members))).toBe(73999)
  })

  it('flags unassigned items and totals that don’t match', () => {
    const split = canteen.split as Extract<Split, { mode: 'itemized' }>
    const items = split.items.map((i) => (i.id === 'coffee' ? { ...i, assignees: [] } : i))
    expect(validateExpense(expense({ ...split, items }, 85000))).toEqual([
      'Assign Cold coffee to someone.',
      'Items and charges add up to ₹840.00, not ₹850.00.',
    ])
  })
})

describe('validation of payers', () => {
  it('payments must add up to the amount', () => {
    const e: Expense = { ...expense({ mode: 'equal', members }, 10000), paidBy: { riya: 9000 } }
    expect(validateExpense(e)).toEqual(['Payments add up to ₹90.00, not ₹100.00.'])
  })

  it('rejects zero amounts and missing payers', () => {
    const e: Expense = { ...expense({ mode: 'equal', members: [] }, 0), paidBy: {} }
    expect(validateExpense(e)).toEqual([
      'Enter an amount above ₹0.',
      'Choose who paid.',
      'Choose at least one person to split with.',
    ])
  })
})
