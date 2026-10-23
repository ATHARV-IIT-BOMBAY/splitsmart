import { formatINR, parseRupees } from '../../core/money'
import { validateExpense } from '../../core/split'
import type { Expense, MemberId, Split } from '../../core/types'

export type ManualMode = 'equal' | 'exact' | 'percent' | 'shares'

/** What the manual expense form holds: raw text, exactly as typed. */
export interface Draft {
  title: string
  amount: string
  payer: MemberId
  date: string
  mode: ManualMode
  /** Who shares the bill in equal mode. */
  included: MemberId[]
  /** Per-person text for exact (₹), percent (%) and shares modes. */
  values: Record<MemberId, string>
}

export const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export function newDraft(memberIds: MemberId[], payer: MemberId): Draft {
  return { title: '', amount: '', payer, date: today(), mode: 'equal', included: memberIds, values: {} }
}

const toText = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, '')

export function draftFromExpense(expense: Expense, memberIds: MemberId[]): Draft {
  const payer = Object.keys(expense.paidBy)[0]
  const base = { ...newDraft(memberIds, payer), title: expense.title, amount: toText(expense.amountPaise), date: expense.date }
  const s = expense.split
  switch (s.mode) {
    case 'equal':
      return { ...base, included: s.members }
    case 'exact':
      return { ...base, mode: 'exact', values: mapValues(s.amounts, toText) }
    case 'percent':
      return { ...base, mode: 'percent', values: mapValues(s.basisPoints, toText) }
    case 'shares':
      return { ...base, mode: 'shares', values: mapValues(s.shares, String) }
    case 'itemized':
      throw new Error('Itemized expenses are edited on the receipt screen')
  }
}

const mapValues = <T, U>(record: Record<string, T>, fn: (v: T) => U) =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fn(v)]))

/**
 * Turns the form into an Expense and lists every problem to fix.
 * Percentages reuse the 2-decimal amount parser: "33.33" → 3333 basis points.
 */
export function draftToExpense(
  draft: Draft,
  id: string,
  nameOf: (id: MemberId) => string,
): { expense: Expense; problems: string[] } {
  const problems: string[] = []
  const amountPaise = parseRupees(draft.amount) ?? 0
  if (!draft.title.trim()) problems.push('Add a description.')
  if (draft.amount.trim() && parseRupees(draft.amount) === null) problems.push('Enter the amount as a number, like 840 or 99.50.')

  const parsed: Record<MemberId, number> = {}
  for (const [memberId, text] of Object.entries(draft.values)) {
    if (!text.trim()) continue
    const value = draft.mode === 'shares' ? (/^\d+$/.test(text.trim()) ? Number(text) : null) : parseRupees(text)
    if (value === null || value < 0) problems.push(`Check the value for ${nameOf(memberId)}.`)
    else if (value > 0) parsed[memberId] = value
  }

  let split: Split
  switch (draft.mode) {
    case 'equal':
      split = { mode: 'equal', members: draft.included }
      break
    case 'exact':
      split = { mode: 'exact', amounts: parsed }
      break
    case 'percent':
      split = { mode: 'percent', basisPoints: parsed }
      break
    case 'shares':
      split = { mode: 'shares', shares: parsed }
      break
  }

  const expense: Expense = {
    id,
    title: draft.title.trim(),
    date: draft.date || today(),
    amountPaise,
    paidBy: draft.payer ? { [draft.payer]: amountPaise } : {},
    split,
  }
  return { expense, problems: [...problems, ...validateExpense(expense)] }
}

/** Live helper text under the split inputs, e.g. "₹40.00 left to assign". */
export function remainingLabel(draft: Draft): string | null {
  const values = Object.values(draft.values).filter((v) => v.trim())
  if (draft.mode === 'exact') {
    const total = parseRupees(draft.amount) ?? 0
    const assigned = values.reduce((sum, v) => sum + (parseRupees(v) ?? 0), 0)
    const left = total - assigned
    return left === 0 ? 'Adds up to the bill' : left > 0 ? `${formatINR(left)} left to assign` : `${formatINR(-left)} over the bill`
  }
  if (draft.mode === 'percent') {
    const total = values.reduce((sum, v) => sum + (parseRupees(v) ?? 0), 0)
    return total === 10000 ? 'Adds up to 100%' : `${total / 100}% of 100%`
  }
  return null
}
