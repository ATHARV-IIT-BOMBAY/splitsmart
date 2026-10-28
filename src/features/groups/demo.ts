import { newMember } from '../../core/members'
import type { Expense, Group, Member, Split } from '../../core/types'

/*
 * A ready-made trip so anyone (judges included) can see balances, the fewest
 * payments, UPI, charts and exports in one tap: 5 people, 11 expenses with
 * different payers, one scanned receipt split item by item, and one payment made.
 */

const id = () => crypto.randomUUID()
const rupees = (r: number) => Math.round(r * 100)

export function demoGroup(): Group {
  const members: Member[] = []
  for (const name of ['Riya', 'Arjun', 'Meera', 'Kabir', 'Dev']) members.push(newMember(name, members))
  members[0].upiId = 'riya@okaxis'
  members[1].upiId = 'arjun@ybl'
  const [R, A, M, K, D] = members.map((m) => m.id)
  const all = [R, A, M, K, D]

  const expense = (title: string, amount: number, payer: string, date: string, category: Expense['category'], split: Split): Expense => ({
    id: id(),
    title,
    date,
    amountPaise: rupees(amount),
    paidBy: { [payer]: rupees(amount) },
    split,
    category,
  })
  const equal = (members: string[]): Split => ({ mode: 'equal', members })

  const canteen: Split = {
    mode: 'itemized',
    items: [
      { id: id(), name: 'Large Pizza', qty: 1, unitPaise: 40000, totalPaise: 40000, assignees: [R, A, M, K], category: 'Food' },
      { id: id(), name: 'Maggi (1 of 3)', qty: 1, unitPaise: 6000, totalPaise: 6000, assignees: [R], category: 'Food' },
      { id: id(), name: 'Maggi (2 of 3)', qty: 1, unitPaise: 6000, totalPaise: 6000, assignees: [A], category: 'Food' },
      { id: id(), name: 'Maggi (3 of 3)', qty: 1, unitPaise: 6000, totalPaise: 6000, assignees: [K], category: 'Food' },
      { id: id(), name: 'Cold Coffee', qty: 1, unitPaise: 12000, totalPaise: 12000, assignees: [M], category: 'Food' },
      { id: id(), name: 'Garlic Bread', qty: 1, unitPaise: 10000, totalPaise: 10000, assignees: [R, M], category: 'Food' },
    ],
    charges: [
      { id: id(), label: 'CGST @2.5%', kind: 'tax', paise: 2000 },
      { id: id(), label: 'SGST @2.5%', kind: 'tax', paise: 2000 },
    ],
  }

  const expenses: Expense[] = [
    expense('Train tickets to Goa', 4500, R, '2026-10-20', 'Travel', equal(all)),
    expense('Beach shack dinner', 3200, A, '2026-10-20', 'Food', equal(all)),
    expense('Scooter rental', 1800, M, '2026-10-21', 'Travel', { mode: 'shares', shares: { [M]: 2, [K]: 1, [D]: 1 } }),
    expense('Fuel', 600, K, '2026-10-21', 'Travel', equal([M, K, D])),
    expense('Breakfast', 750, D, '2026-10-21', 'Food', equal(all)),
    expense('Cruise tickets', 2500, R, '2026-10-22', 'Entertainment', equal(all)),
    expense('Groceries for the villa', 1200, A, '2026-10-22', 'Groceries', { mode: 'percent', basisPoints: { [R]: 3000, [A]: 3000, [M]: 2000, [K]: 1000, [D]: 1000 } }),
    expense('Club entry', 3000, D, '2026-10-22', 'Entertainment', equal([A, K, D])),
    expense('Villa electricity', 900, M, '2026-10-23', 'Utilities', equal(all)),
    expense('Lunch at the beach', 2100, K, '2026-10-23', 'Food', { mode: 'exact', amounts: { [R]: 50000, [A]: 40000, [M]: 40000, [K]: 30000, [D]: 50000 } }),
    expense('Night canteen order', 840, R, '2026-10-24', 'Food', canteen),
  ]

  return {
    id: id(),
    name: 'Wing B Goa Trip (demo)',
    createdAt: new Date().toISOString(),
    members,
    expenses,
    settlements: [{ id: id(), from: K, to: A, paise: rupees(300), date: '2026-10-24' }],
  }
}
