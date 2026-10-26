import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newMember, usageCount } from '../core/members'
import { dueCopies, type Recurring } from '../core/recurring'
import type { Expense, Group, Member, MemberId, Settlement } from '../core/types'

interface GroupsState {
  groups: Group[]
  createGroup: (name: string, myName: string, friendNames: string[]) => string
  renameGroup: (groupId: string, name: string) => void
  deleteGroup: (groupId: string) => void
  /** Adds a group from a link or backup; `replace` overwrites the copy with the same id. */
  importGroup: (group: Group, options: { meId?: MemberId; replace: boolean }) => string
  addMember: (groupId: string, name: string) => void
  /** Change a member's name, colour, emoji or UPI ID. */
  updateMember: (groupId: string, memberId: MemberId, changes: Partial<Omit<Member, 'id'>>) => void
  /** Returns a message instead of removing when the member is in use. */
  removeMember: (groupId: string, memberId: MemberId) => string | null
  saveExpense: (groupId: string, expense: Expense) => void
  deleteExpense: (groupId: string, expenseId: string) => void
  addSettlement: (groupId: string, settlement: Omit<Settlement, 'id'>) => void
  deleteSettlement: (groupId: string, settlementId: string) => void
  addRecurring: (groupId: string, rule: Recurring) => void
  stopRecurring: (groupId: string, ruleId: string) => void
  /** Adds every repeating expense that has come due by `today` (YYYY-MM-DD). */
  catchUpRecurring: (today: string) => void
}

/**
 * All app data. `persist` saves it to localStorage after every change, so
 * groups, expenses and settlements survive a refresh and work offline.
 */
export const useGroups = create<GroupsState>()(
  persist(
    (set, get) => {
      const update = (groupId: string, change: (group: Group) => Group) =>
        set((state) => ({ groups: state.groups.map((g) => (g.id === groupId ? change(g) : g)) }))

      return {
        groups: [],

        createGroup(name, myName, friendNames) {
          const members: Member[] = []
          for (const memberName of [myName, ...friendNames]) members.push(newMember(memberName, members))
          const group: Group = {
            id: crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString(),
            meId: members[0].id,
            members,
            expenses: [],
            settlements: [],
          }
          set((state) => ({ groups: [group, ...state.groups] }))
          return group.id
        },

        renameGroup: (groupId, name) => update(groupId, (g) => ({ ...g, name })),

        importGroup(group, { meId, replace }) {
          const exists = get().groups.some((g) => g.id === group.id)
          const id = exists && !replace ? crypto.randomUUID() : group.id
          const imported = { ...group, id, meId }
          set((state) => ({
            groups: exists && replace ? state.groups.map((g) => (g.id === id ? imported : g)) : [imported, ...state.groups],
          }))
          return id
        },

        deleteGroup: (groupId) => set((state) => ({ groups: state.groups.filter((g) => g.id !== groupId) })),

        addMember: (groupId, name) =>
          update(groupId, (g) => ({ ...g, members: [...g.members, newMember(name, g.members)] })),

        updateMember: (groupId, memberId, changes) =>
          update(groupId, (g) => ({
            ...g,
            members: g.members.map((m) => (m.id === memberId ? { ...m, ...changes } : m)),
          })),

        removeMember(groupId, memberId) {
          const group = get().groups.find((g) => g.id === groupId)
          const member = group?.members.find((m) => m.id === memberId)
          if (!group || !member) return null
          const uses = usageCount(group, memberId)
          if (uses > 0) {
            return `${member.name} still has ${uses} ${uses === 1 ? 'expense or payment' : 'expenses or payments'}. Settle or delete those first.`
          }
          update(groupId, (g) => ({
            ...g,
            meId: g.meId === memberId ? undefined : g.meId,
            members: g.members.filter((m) => m.id !== memberId),
          }))
          return null
        },

        saveExpense: (groupId, expense) =>
          update(groupId, (g) => {
            const exists = g.expenses.some((e) => e.id === expense.id)
            return {
              ...g,
              expenses: exists ? g.expenses.map((e) => (e.id === expense.id ? expense : e)) : [...g.expenses, expense],
            }
          }),

        deleteExpense: (groupId, expenseId) =>
          update(groupId, (g) => ({ ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) })),

        addSettlement: (groupId, settlement) =>
          update(groupId, (g) => ({
            ...g,
            settlements: [...g.settlements, { ...settlement, id: crypto.randomUUID() }],
          })),

        addRecurring: (groupId, rule) => update(groupId, (g) => ({ ...g, recurring: [...(g.recurring ?? []), rule] })),

        stopRecurring: (groupId, ruleId) =>
          update(groupId, (g) => ({ ...g, recurring: (g.recurring ?? []).filter((r) => r.id !== ruleId) })),

        catchUpRecurring: (today) =>
          set((state) => ({
            groups: state.groups.map((g) => {
              if (!g.recurring?.length) return g
              const { copies, rules } = dueCopies(g.recurring, today, () => crypto.randomUUID())
              return copies.length ? { ...g, expenses: [...g.expenses, ...copies], recurring: rules } : g
            }),
          })),

        deleteSettlement: (groupId, settlementId) =>
          update(groupId, (g) => ({ ...g, settlements: g.settlements.filter((s) => s.id !== settlementId) })),
      }
    },
    { name: 'splitsmart', version: 1 },
  ),
)

export const useGroup = (groupId: string) => useGroups((state) => state.groups.find((g) => g.id === groupId))
