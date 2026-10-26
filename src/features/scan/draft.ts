import { allocate } from '../../core/allocate'
import { formatINR, parseRupees, type Paise } from '../../core/money'
import type { Box, ParsedReceipt } from '../../core/parse'
import { validateExpense } from '../../core/split'
import { mainCategory } from '../../core/categories'
import type { Category, Charge, Expense, Item, MemberId } from '../../core/types'

/*
 * The editable receipt behind the review and assign screens. Amounts stay as
 * the text the user typed until we build the final Expense.
 */

export interface ItemRow {
  id: string
  name: string
  qty: string
  unit: string
  total: string
  assignees: MemberId[]
  /** Set by the on-device model, or by the user tapping the chip. */
  category?: Category
  bbox?: Box
  /** OCR wasn't sure; cleared as soon as the user edits that field. */
  doubtfulName?: boolean
  doubtfulAmount?: boolean
}

export interface ChargeRow {
  id: string
  label: string
  kind: Charge['kind']
  amount: string
  bbox?: Box
  doubtful?: boolean
}

export interface ScanDraft {
  items: ItemRow[]
  charges: ChargeRow[]
  printedTotal: string
}

const text = (paise: Paise | undefined) => (paise === undefined ? '' : (paise / 100).toFixed(2))
const id = () => crypto.randomUUID()

export function draftFromParsed(parsed: ParsedReceipt): ScanDraft {
  return {
    items: parsed.items.map((item) => ({
      id: id(),
      name: item.name,
      qty: String(item.qty),
      unit: text(item.unitPaise),
      total: text(item.totalPaise),
      assignees: [],
      bbox: item.bbox,
      doubtfulName: item.doubtfulName,
      doubtfulAmount: item.doubtfulAmount,
    })),
    charges: parsed.charges.map((c) => ({
      id: id(),
      label: c.label,
      kind: c.kind,
      amount: text(c.paise),
      bbox: c.bbox,
      doubtful: c.doubtful,
    })),
    printedTotal: text(parsed.totalPaise),
  }
}

/** Back from a saved receipt to an editable draft (no photo; totals as saved). */
export function draftFromExpense(expense: Expense): ScanDraft {
  if (expense.split.mode !== 'itemized') return { items: [], charges: [], printedTotal: '' }
  return {
    items: expense.split.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: String(item.qty),
      unit: text(item.unitPaise),
      total: text(item.totalPaise),
      assignees: item.assignees,
      category: item.category,
    })),
    charges: expense.split.charges.map((c) => ({ id: c.id, label: c.label, kind: c.kind, amount: text(c.paise) })),
    printedTotal: text(expense.amountPaise),
  }
}

export const emptyItem = (): ItemRow => ({ id: id(), name: '', qty: '1', unit: '', total: '', assignees: [] })
export const emptyCharge = (): ChargeRow => ({ id: id(), label: 'Tax', kind: 'tax', amount: '' })

/** Editing qty or unit price keeps the line total in step: 3 × 60 = 180. */
export function editItem(row: ItemRow, patch: Partial<Pick<ItemRow, 'name' | 'qty' | 'unit' | 'total'>>): ItemRow {
  const next = { ...row, ...patch }
  if ('name' in patch) next.doubtfulName = false
  if ('qty' in patch || 'unit' in patch || 'total' in patch) next.doubtfulAmount = false
  if ('qty' in patch || 'unit' in patch) {
    const qty = Number(next.qty)
    const unit = parseRupees(next.unit)
    if (Number.isInteger(qty) && qty > 0 && unit !== null) next.total = text(qty * unit)
  }
  return next
}

export function totals(draft: ScanDraft) {
  const sum = (values: string[]) => values.reduce((s, v) => s + (parseRupees(v) ?? 0), 0)
  const calculated = sum(draft.items.map((i) => i.total)) + sum(draft.charges.map((c) => c.amount))
  const printed = draft.printedTotal.trim() ? parseRupees(draft.printedTotal) : null
  return { calculated, printed, difference: printed === null ? 0 : calculated - printed }
}

/** "Maggi × 3 = ₹180" becomes three ₹60 Maggi lines that can go to different people. */
export function splitIntoUnits(row: ItemRow): ItemRow[] {
  const qty = Number(row.qty)
  const total = parseRupees(row.total)
  if (!Number.isInteger(qty) || qty < 2 || qty > 20 || total === null) return [row]
  return allocate(total, Array(qty).fill(1)).map((paise, i) => ({
    ...row,
    id: id(),
    name: `${row.name} (${i + 1} of ${qty})`,
    qty: '1',
    unit: text(paise),
    total: text(paise),
  }))
}

/** Every problem the user must fix on the review screen before assigning. */
export function reviewProblems(draft: ScanDraft): string[] {
  const problems: string[] = []
  if (draft.items.length === 0) problems.push('Add at least one item.')
  draft.items.forEach((item, i) => {
    const label = item.name.trim() || `Line ${i + 1}`
    if (!item.name.trim()) problems.push(`Give line ${i + 1} a name.`)
    if (parseRupees(item.total) === null) problems.push(`Check the price of ${label}.`)
  })
  draft.charges.forEach((c) => {
    if (parseRupees(c.amount) === null) problems.push(`Check the amount for ${c.label || 'a charge'}.`)
  })
  if (draft.printedTotal.trim() && parseRupees(draft.printedTotal) === null) problems.push('Check the receipt total.')
  return problems
}

/**
 * Builds the itemized Expense. When the user keeps the printed total and it
 * differs from items + charges, the gap becomes an "Adjustment" charge that is
 * split proportionally like tax.
 */
export function draftToExpense(
  draft: ScanDraft,
  meta: { id: string; title: string; date: string; payer: MemberId; usePrinted: boolean },
): { expense: Expense; problems: string[] } {
  const items: Item[] = draft.items.map((row) => ({
    id: row.id,
    name: row.name.trim(),
    qty: Number(row.qty) || 1,
    unitPaise: parseRupees(row.unit) ?? undefined,
    totalPaise: parseRupees(row.total) ?? 0,
    assignees: row.assignees,
    category: row.category,
  }))
  const charges: Charge[] = draft.charges.map((c) => ({
    id: c.id,
    label: c.label.trim() || 'Charge',
    kind: c.kind,
    paise: parseRupees(c.amount) ?? 0,
  }))
  const { calculated, printed, difference } = totals(draft)
  if (meta.usePrinted && printed !== null && difference !== 0) {
    charges.push({ id: id(), label: 'Adjustment to printed total', kind: 'adjustment', paise: -difference })
  }
  const amountPaise = meta.usePrinted && printed !== null ? printed : calculated
  const expense: Expense = {
    id: meta.id,
    title: meta.title.trim() || 'Receipt',
    date: meta.date,
    amountPaise,
    paidBy: { [meta.payer]: amountPaise },
    split: { mode: 'itemized', items, charges },
    category: mainCategory(items),
  }
  return { expense, problems: validateExpense(expense) }
}

export const describeDifference = (difference: Paise) =>
  difference > 0 ? `${formatINR(difference)} more than` : `${formatINR(-difference)} less than`
