import type { Group, Member, MemberId } from './types'

/** Pastel avatar colours that read well with dark text in light and dark mode. */
export const MEMBER_COLORS = [
  '#f9c6b8',
  '#bfe3d0',
  '#c9d7f8',
  '#f6e3a1',
  '#e2c9f2',
  '#f7c8dd',
  '#c8e6f0',
  '#d9e8b5',
] as const

/** "Arjun, Meera,  kabir ," → ["Arjun", "Meera", "kabir"] */
export function parseNames(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((name) => name.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.trim().slice(0, 2)
  return letters.toUpperCase()
}

export function newMember(name: string, existing: readonly Member[]): Member {
  return {
    id: crypto.randomUUID(),
    name,
    color: MEMBER_COLORS[existing.length % MEMBER_COLORS.length],
  }
}

/** How many expenses or settlements involve this member. */
export function usageCount(group: Group, id: MemberId): number {
  const inExpense = group.expenses.filter((e) => {
    if (id in e.paidBy) return true
    const s = e.split
    switch (s.mode) {
      case 'equal':
        return s.members.includes(id)
      case 'exact':
        return id in s.amounts
      case 'percent':
        return id in s.basisPoints
      case 'shares':
        return id in s.shares
      case 'itemized':
        return s.items.some((item) => item.assignees.includes(id))
    }
  }).length
  const inSettlement = group.settlements.filter((s) => s.from === id || s.to === id).length
  return inExpense + inSettlement
}
