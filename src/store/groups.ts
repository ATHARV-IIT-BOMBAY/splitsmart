import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newMember, usageCount } from '../core/members'
import type { Expense, Group, Member, MemberId, Settlement } from '../core/types'

interface GroupsState {
  groups: Group[]
  createGroup: (name: string, myName: string, friendNames: string[]) => string
  renameGroup: (groupId: string, name: string) => void
  deleteGroup: (groupId: string) => void
  addMember: (groupId: string, name: string) => void
  /** Returns a message instead of removing when the member is in use. */
  removeMember: (groupId: string, memberId: MemberId) => string | null
  saveExpense: (groupId: string, expense: Expense) => void
  deleteExpense: (groupId: string, expenseId: string) => void
  addSettlement: (groupId: string, settlement: Omit<Settlement, 'id'>) => void
  deleteSettlement: (groupId: string, settlementId: string) => void
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

        deleteGroup: (groupId) => set((state) => ({ groups: state.groups.filter((g) => g.id !== groupId) })),

        addMember: (groupId, name) =>
          update(groupId, (g) => ({ ...g, members: [...g.members, newMember(name, g.members)] })),

        removeMember(groupId, memberId) {
          const group = get().groups.find((g) => g.id === groupId)
          const member = group?.members.find((m) => m.id === memberId)
          if (!group || !member) return null
          const uses = usageCount(group, memberId)
          if (uses > 0) {
            return `${member.name} is part of ${uses} ${uses === 1 ? 'expense or payment' : 'expenses or payments'}. Remove them from those first.`
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

        deleteSettlement: (groupId, settlementId) =>
          update(groupId, (g) => ({ ...g, settlements: g.settlements.filter((s) => s.id !== settlementId) })),
      }
    },
    { name: 'splitsmart', version: 1 },
  ),
)

export const useGroup = (groupId: string) => useGroups((state) => state.groups.find((g) => g.id === groupId))
