import type { Paise } from './money'
import type { Recurring } from './recurring'

export type MemberId = string

export type AvatarStyle = 'adventurer' | 'bottts' | 'funEmoji' | 'lorelei' | 'thumbs'

export interface Member {
  id: MemberId
  name: string
  color: string
  emoji?: string
  upiId?: string
  /** Illustrated character; `seed` picks which one. */
  avatar?: { style: AvatarStyle; seed: string }
}

export type Category = 'Food' | 'Groceries' | 'Travel' | 'Utilities' | 'Entertainment' | 'Other'

/** One line on a receipt. `assignees` share it equally. */
export interface Item {
  id: string
  name: string
  qty: number
  unitPaise?: Paise
  totalPaise: Paise
  assignees: MemberId[]
  category?: Category
}

/** Tax, service charge, discount (negative), round off, packing, adjustment… */
export interface Charge {
  id: string
  label: string
  kind: 'tax' | 'service' | 'discount' | 'roundoff' | 'delivery' | 'adjustment' | 'other'
  paise: Paise
}

export type Split =
  | { mode: 'equal'; members: MemberId[] }
  | { mode: 'exact'; amounts: Record<MemberId, Paise> }
  /** 10000 basis points = 100%, so 33.33% is 3333. */
  | { mode: 'percent'; basisPoints: Record<MemberId, number> }
  | { mode: 'shares'; shares: Record<MemberId, number> }
  | { mode: 'itemized'; items: Item[]; charges: Charge[] }

export interface Expense {
  id: string
  title: string
  /** ISO date, e.g. "2026-10-22". */
  date: string
  amountPaise: Paise
  /** Who paid how much. Usually one person paying the whole amount. */
  paidBy: Record<MemberId, Paise>
  split: Split
  category?: Category
  receiptId?: string
  /** Set on copies made by a repeating expense (see core/recurring.ts). */
  recurringId?: string
}

/** A payment one member made to another to settle up. */
export interface Settlement {
  id: string
  from: MemberId
  to: MemberId
  paise: Paise
  date: string
}

export interface Group {
  id: string
  name: string
  createdAt?: string
  /** The member who uses this device, so the app can say "you owe". */
  meId?: MemberId
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
  recurring?: Recurring[]
}
