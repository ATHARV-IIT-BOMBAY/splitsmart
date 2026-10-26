import { validateExpense } from './split'
import type { Expense, Group, Member, Settlement, Split } from './types'

/*
 * Moving a group between phones without a server: as a JSON backup file, or
 * compressed into a link (and QR code). Anything coming in is untrusted, so it
 * is checked field by field before it's allowed into the app.
 */

const FORMAT = 'splitsmart-group'

export function toBackup(group: Group): string {
  return JSON.stringify({ format: FORMAT, version: 1, group }, null, 2)
}

class BadGroup extends Error {}
const fail = (what: string): never => {
  throw new BadGroup(`This isn’t a valid SplitSmart group (${what}).`)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, what: string, max = 200): string =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail(what)
const paise = (v: unknown, what: string): number => (Number.isSafeInteger(v) ? (v as number) : fail(what))
const record = (v: unknown, what: string, ids: Set<string>): Record<string, number> => {
  if (!isObject(v)) fail(what)
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(v as object)) {
    if (!ids.has(k)) fail(`${what} mentions someone not in the group`)
    out[k] = paise(n, what)
  }
  return out
}

function member(v: unknown): Member {
  if (!isObject(v)) fail('member')
  const m = v as Record<string, unknown>
  const out: Member = { id: str(m.id, 'member id', 64), name: str(m.name, 'member name', 60), color: str(m.color, 'member colour', 30) }
  if (m.emoji !== undefined) out.emoji = str(m.emoji, 'member emoji', 16)
  if (m.upiId !== undefined) out.upiId = str(m.upiId, 'UPI ID', 120)
  if (isObject(m.avatar)) out.avatar = { style: str(m.avatar.style, 'avatar', 20) as never, seed: str(m.avatar.seed, 'avatar', 40) }
  return out
}

function split(v: unknown, ids: Set<string>): Split {
  if (!isObject(v)) fail('split')
  const s = v as Record<string, unknown>
  switch (s.mode) {
    case 'equal':
      if (!Array.isArray(s.members) || s.members.some((id) => !ids.has(id))) fail('split members')
      return { mode: 'equal', members: s.members as string[] }
    case 'exact':
      return { mode: 'exact', amounts: record(s.amounts, 'exact split', ids) }
    case 'percent':
      return { mode: 'percent', basisPoints: record(s.basisPoints, 'percent split', ids) }
    case 'shares':
      return { mode: 'shares', shares: record(s.shares, 'shares split', ids) }
    case 'itemized': {
      if (!Array.isArray(s.items) || !Array.isArray(s.charges)) fail('receipt items')
      const items = (s.items as unknown[]).map((raw) => {
        if (!isObject(raw)) fail('receipt item')
        const i = raw as Record<string, unknown>
        if (!Array.isArray(i.assignees) || i.assignees.some((id) => !ids.has(id))) fail('item assignees')
        return {
          id: str(i.id, 'item id', 64),
          name: str(i.name, 'item name'),
          qty: typeof i.qty === 'number' && i.qty > 0 ? i.qty : fail('item quantity'),
          unitPaise: i.unitPaise === undefined ? undefined : paise(i.unitPaise, 'item price'),
          totalPaise: paise(i.totalPaise, 'item price'),
          assignees: i.assignees as string[],
          category: i.category as Expense['category'],
        }
      })
      const charges = (s.charges as unknown[]).map((raw) => {
        if (!isObject(raw)) fail('charge')
        const c = raw as Record<string, unknown>
        return { id: str(c.id, 'charge id', 64), label: str(c.label, 'charge name'), kind: str(c.kind, 'charge kind', 20) as never, paise: paise(c.paise, 'charge') }
      })
      return { mode: 'itemized', items, charges }
    }
    default:
      return fail('split mode')
  }
}

/** Checks untrusted data (a backup file or a shared link) and returns a clean Group. */
export function parseGroup(data: unknown): Group {
  const outer = isObject(data) && data.format === FORMAT ? data.group : data
  if (!isObject(outer)) fail('not a group')
  const g = outer as Record<string, unknown>
  if (!Array.isArray(g.members) || g.members.length === 0 || g.members.length > 50) fail('members')
  const members = (g.members as unknown[]).map(member)
  const ids = new Set(members.map((m) => m.id))
  if (ids.size !== members.length) fail('duplicate members')

  const expenses: Expense[] = (Array.isArray(g.expenses) ? g.expenses : fail('expenses')).map((raw: unknown) => {
    if (!isObject(raw)) fail('expense')
    const e = raw as Record<string, unknown>
    const expense: Expense = {
      id: str(e.id, 'expense id', 64),
      title: str(e.title, 'expense name'),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.date)) ? String(e.date) : fail('expense date'),
      amountPaise: paise(e.amountPaise, 'expense amount'),
      paidBy: record(e.paidBy, 'who paid', ids),
      split: split(e.split, ids),
      category: e.category as Expense['category'],
    }
    // The maths has to add up too, or balances would be wrong
    if (validateExpense(expense).length > 0) fail(`“${expense.title}” doesn’t add up`)
    return expense
  })

  const settlements: Settlement[] = (Array.isArray(g.settlements) ? g.settlements : []).map((raw: unknown) => {
    if (!isObject(raw)) fail('payment')
    const s = raw as Record<string, unknown>
    if (!ids.has(String(s.from)) || !ids.has(String(s.to))) fail('payment between unknown people')
    return { id: str(s.id, 'payment id', 64), from: String(s.from), to: String(s.to), paise: paise(s.paise, 'payment'), date: str(s.date, 'payment date', 10) }
  })

  return {
    id: str(g.id, 'group id', 64),
    name: str(g.name, 'group name', 80),
    createdAt: typeof g.createdAt === 'string' ? g.createdAt : undefined,
    meId: undefined, // whoever opens it picks who they are
    members,
    expenses,
    settlements,
  }
}

export { BadGroup }

// --- Links: JSON → deflate (built into browsers) → base64url ---

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function encodeGroup(group: Group): Promise<string> {
  const { meId: _me, ...shared } = group // "who I am" is personal, not part of the group
  void _me
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(shared)), new CompressionStream('deflate-raw'))
  let binary = ''
  for (const b of packed) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function decodeGroup(code: string): Promise<Group> {
  try {
    const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')))
    return parseGroup(JSON.parse(json))
  } catch (error) {
    if (error instanceof BadGroup) throw error
    throw new BadGroup('This link is broken or incomplete. Ask for it to be sent again.')
  }
}
