import { describe, expect, it } from 'vitest'
import { decodeGroup, encodeGroup, parseGroup, toBackup } from './backup'
import type { Group } from './types'

const group: Group = {
  id: 'g1',
  name: 'Night Canteen Gang',
  meId: 'riya',
  members: [
    { id: 'riya', name: 'Riya', color: '#f9c6b8', upiId: 'riya@okaxis' },
    { id: 'arjun', name: 'Arjun', color: '#bfe3d0' },
  ],
  expenses: [
    {
      id: 'e1',
      title: 'Maggi',
      date: '2026-10-27',
      amountPaise: 12000,
      paidBy: { riya: 12000 },
      split: { mode: 'equal', members: ['riya', 'arjun'] },
      category: 'Food',
    },
  ],
  settlements: [{ id: 's1', from: 'arjun', to: 'riya', paise: 6000, date: '2026-10-27' }],
}

describe('group backup and links', () => {
  it('round-trips through a backup file, dropping "who I am"', () => {
    const back = parseGroup(JSON.parse(toBackup(group)))
    expect(back).toEqual({ ...group, meId: undefined, createdAt: undefined })
  })

  it('round-trips through a compressed link', async () => {
    const code = await encodeGroup(group)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect((await decodeGroup(code)).expenses[0].title).toBe('Maggi')
  })

  it('rejects broken links with a friendly message', async () => {
    await expect(decodeGroup('not-a-real-link')).rejects.toThrow('This link is broken or incomplete')
  })

  it.each([
    ['payments by unknown people', { ...group, expenses: [{ ...group.expenses[0], paidBy: { mallory: 12000 } }] }],
    ['money that isn’t whole paise', { ...group, expenses: [{ ...group.expenses[0], amountPaise: 1.5 }] }],
    ['expenses that don’t add up', { ...group, expenses: [{ ...group.expenses[0], paidBy: { riya: 999 } }] }],
    ['no members', { ...group, members: [] }],
    ['a script instead of a name', { ...group, name: 42 }],
  ])('rejects %s', (_, bad) => {
    expect(() => parseGroup(bad)).toThrow('This isn’t a valid SplitSmart group')
  })

  it('rejects unknown categories, charge kinds and avatar styles from a crafted link', () => {
    const tweak = (change: (g: Record<string, any>) => void) => {
      const copy = JSON.parse(JSON.stringify(group))
      change(copy)
      return () => parseGroup(copy)
    }
    expect(tweak((g) => (g.expenses[0].category = 'Bitcoin'))).toThrow(/category/)
    expect(tweak((g) => (g.members[0].avatar = { style: 'zzz', seed: 'Mia' }))).toThrow(/avatar/)
    expect(tweak((g) => (g.members[0].avatar = { style: 'bottts', seed: 'Mia' }))).not.toThrow()
  })
})
