import { allocate } from './allocate'
import { formatINR, type Paise } from './money'
import type { Expense, Item, MemberId } from './types'

export type Shares = Record<MemberId, Paise>

/**
 * Who gets leftover rounding paise first: payers (biggest payment first),
 * then everyone else in the order they joined the group.
 */
function tiePriority(expense: Expense, memberOrder: readonly MemberId[]): MemberId[] {
  const payers = Object.entries(expense.paidBy)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id)
  return [...new Set([...payers, ...memberOrder])]
}

/** Splits `total` among `ids` by `weights`, breaking ties by `priority`. */
function allocateTo(
  total: Paise,
  ids: readonly MemberId[],
  weights: readonly number[],
  priority: readonly MemberId[],
): Shares {
  const indexOf = new Map(ids.map((id, i) => [id, i]))
  const order = priority.filter((id) => indexOf.has(id)).map((id) => indexOf.get(id)!)
  const parts = allocate(total, weights, order)
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]))
}

export function itemsSubtotal(items: readonly Item[]): Paise {
  return items.reduce((sum, item) => sum + item.totalPaise, 0)
}

/**
 * Each person's share of an itemized bill:
 * 1. every item is split equally among the people who had it;
 * 2. tax, service charge, discounts etc. are split in proportion to what
 *    each person's items cost (₹600 of a ₹1,000 bill pays 60% of the tax).
 */
function itemizedShares(
  expense: Expense & { split: { mode: 'itemized' } },
  priority: readonly MemberId[],
): Shares {
  const { items, charges } = expense.split
  const subtotals: Shares = {}
  for (const item of items) {
    const portions = allocateTo(item.totalPaise, item.assignees, item.assignees.map(() => 1), priority)
    for (const [id, paise] of Object.entries(portions)) subtotals[id] = (subtotals[id] ?? 0) + paise
  }

  const ids = Object.keys(subtotals)
  const chargesTotal = charges.reduce((sum, c) => sum + c.paise, 0)
  // Split all charges in one go so rounding happens once, not per charge.
  const chargeShares = allocateTo(chargesTotal, ids, ids.map((id) => subtotals[id]), priority)
  return Object.fromEntries(ids.map((id) => [id, subtotals[id] + chargeShares[id]]))
}

/**
 * How much of `expense` each member is responsible for.
 * Call `validateExpense` first; this assumes the expense is valid.
 * The returned shares always add up to the expense amount exactly.
 */
export function computeShares(expense: Expense, memberOrder: readonly MemberId[]): Shares {
  const priority = tiePriority(expense, memberOrder)
  const { split, amountPaise } = expense
  switch (split.mode) {
    case 'equal':
      return allocateTo(amountPaise, split.members, split.members.map(() => 1), priority)
    case 'exact':
      return { ...split.amounts }
    case 'percent': {
      const ids = Object.keys(split.basisPoints)
      return allocateTo(amountPaise, ids, ids.map((id) => split.basisPoints[id]), priority)
    }
    case 'shares': {
      const ids = Object.keys(split.shares)
      return allocateTo(amountPaise, ids, ids.map((id) => split.shares[id]), priority)
    }
    case 'itemized':
      return itemizedShares({ ...expense, split }, priority)
  }
}

const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0)

/** Returns problems a user must fix before saving, or [] when valid. */
export function validateExpense(expense: Expense): string[] {
  const problems: string[] = []
  const { split, amountPaise } = expense

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) problems.push('Enter an amount above ₹0.')
  if (Object.keys(expense.paidBy).length === 0) problems.push('Choose who paid.')
  else if (sum(expense.paidBy) !== amountPaise) {
    problems.push(`Payments add up to ${formatINR(sum(expense.paidBy))}, not ${formatINR(amountPaise)}.`)
  }

  switch (split.mode) {
    case 'equal':
      if (split.members.length === 0) problems.push('Choose at least one person to split with.')
      break
    case 'exact': {
      const diff = amountPaise - sum(split.amounts)
      if (Object.values(split.amounts).some((p) => !Number.isSafeInteger(p) || p < 0)) {
        problems.push('Amounts can’t be negative.')
      }
      if (diff > 0) problems.push(`${formatINR(diff)} still to assign.`)
      if (diff < 0) problems.push(`${formatINR(-diff)} more than the bill.`)
      break
    }
    case 'percent': {
      const total = sum(split.basisPoints)
      if (total !== 10000) problems.push(`Percentages add up to ${total / 100}%, not 100%.`)
      break
    }
    case 'shares':
      if (Object.values(split.shares).some((s) => !Number.isSafeInteger(s) || s < 0)) {
        problems.push('Shares must be whole numbers.')
      } else if (sum(split.shares) === 0) problems.push('Give at least one person a share.')
      break
    case 'itemized': {
      const unassigned = split.items.filter((item) => item.assignees.length === 0)
      if (unassigned.length > 0) {
        problems.push(`Assign ${unassigned.map((i) => i.name || 'unnamed item').join(', ')} to someone.`)
      }
      if (split.items.length === 0) problems.push('Add at least one item.')
      else if (itemsSubtotal(split.items) <= 0 && split.charges.some((c) => c.paise !== 0)) {
        problems.push('Items must cost more than ₹0 to split taxes and charges.')
      }
      const billTotal = itemsSubtotal(split.items) + split.charges.reduce((s, c) => s + c.paise, 0)
      if (billTotal !== amountPaise) {
        problems.push(`Items and charges add up to ${formatINR(billTotal)}, not ${formatINR(amountPaise)}.`)
      }
      break
    }
  }
  return problems
}
