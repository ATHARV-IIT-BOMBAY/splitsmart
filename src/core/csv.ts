import { computeShares } from './split'
import type { Group } from './types'

const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
const rupees = (paise: number) => (paise / 100).toFixed(2)

export function groupToCsv(group: Group): string {
  const memberIds = group.members.map((m) => m.id)
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? ''
  const header = ['Date', 'Description', 'Category', 'Paid by', 'Amount (₹)', ...group.members.map((m) => m.name)]

  const rows = group.expenses.map((expense) => {
    const shares = computeShares(expense, memberIds)
    const payers = Object.entries(expense.paidBy)
      .filter(([, paise]) => paise > 0)
      .map(([id]) => nameOf(id))
      .join(' + ')

    return [
      expense.date,
      expense.title,
      expense.category ?? '',
      payers,
      rupees(expense.amountPaise),
      ...memberIds.map((id) => rupees(shares[id] ?? 0)),
    ]
  })

  return [header, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')
}