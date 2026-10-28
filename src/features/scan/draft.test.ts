import { describe, expect, it } from 'vitest'
import { draftToExpense, editItem, emptyItem, splitIntoUnits, totals, type ScanDraft } from './draft'

const meta = { id: 'e1', title: 'Night canteen', date: '2026-10-24', payer: 'riya' }
const row = (name: string, qty: string, total: string, assignees = ['riya']) => ({
  ...emptyItem(),
  name,
  qty,
  total,
  assignees,
})

describe('scan draft', () => {
  it('keeps the line total in step with qty × unit price', () => {
    expect(editItem(row('Maggi', '1', '60.00'), { qty: '3', unit: '60' }).total).toBe('180.00')
  })

  it('fixing a misread total updates the rate when it divides evenly', () => {
    expect(editItem(row('Butter Roti', '14', '34.00'), { total: '364' }).unit).toBe('26.00')
    expect(editItem(row('Lassi', '3', '100'), { total: '100' }).unit).toBe('')
  })

  it('splits "Maggi × 3" into three single units that add up exactly', () => {
    const units = splitIntoUnits(row('Maggi', '3', '100'))
    expect(units.map((u) => [u.name, u.total])).toEqual([
      ['Maggi (1 of 3)', '33.34'],
      ['Maggi (2 of 3)', '33.33'],
      ['Maggi (3 of 3)', '33.33'],
    ])
  })

  it('reports how far items + charges are from the printed total', () => {
    const draft: ScanDraft = {
      items: [row('Pizza', '1', '400'), row('Coffee', '1', '128')],
      charges: [{ id: 'c', label: 'GST', kind: 'tax', amount: '26.40' }],
      printedTotal: '546.00',
    }
    expect(totals(draft)).toEqual({ calculated: 55440, printed: 54600, difference: 840 })
  })

  it('keeping the printed total adds an adjustment so the bill still adds up', () => {
    const draft: ScanDraft = { items: [row('Pizza', '1', '400', ['riya', 'arjun'])], charges: [], printedTotal: '410' }
    const { expense, problems } = draftToExpense(draft, { ...meta, usePrinted: true })
    expect(problems).toEqual([])
    expect(expense.amountPaise).toBe(41000)
    expect(expense.split.mode === 'itemized' && expense.split.charges.at(-1)?.paise).toBe(1000)
  })

  it('flags unassigned items before saving', () => {
    const draft: ScanDraft = { items: [row('Chai', '1', '20', [])], charges: [], printedTotal: '' }
    expect(draftToExpense(draft, { ...meta, usePrinted: false }).problems).toEqual(['Assign Chai to someone.'])
  })
})
