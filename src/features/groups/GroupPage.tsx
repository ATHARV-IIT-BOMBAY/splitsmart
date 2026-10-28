import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Avatar, Money, Sheet } from '../../components/ui'
import { button, card, input } from '../../components/styles'
import { computeBalances } from '../../core/balances'
import type { Group, Member } from '../../core/types'
import { href, navigate } from '../../lib/router'
import { useGroup, useGroups } from '../../store/groups'
import { BalancesPanel } from '../balances/BalancesPanel'
import { ExpenseList } from '../expenses/ExpenseList'
import { ShareGroup } from './ShareGroup'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const TABS = ['Expenses', 'Balances', 'Members'] as const
type Tab = (typeof TABS)[number]

// The picker pulls in the avatar art library, so it loads only when opened
const AvatarPicker = lazy(() => import('./AvatarPicker'))

export function GroupPage({ groupId }: { groupId: string }) {
  const group = useGroup(groupId)
  const [tab, setTab] = useState<Tab>('Expenses')
  const [sheet, setSheet] = useState<'share' | 'settings' | null>(null)

  if (!group) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">This group doesn’t exist on this device.</p>
        <a href={href()} className={`${button.secondary} mt-4`}>
          Back to groups
        </a>
      </main>
    )
  }

  const spent = group.expenses.reduce((sum, e) => sum + e.amountPaise, 0)

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 lg:max-w-6xl">
      <a href={href()} className={button.ghost}>
        ← All groups
      </a>

      <header className={`${card} mt-2 p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{group.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {plural(group.members.length, 'person', 'people')} · {plural(group.expenses.length, 'expense', 'expenses')} ·{' '}
              <Money paise={spent} /> spent
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className={`${button.secondary} text-sm`} onClick={() => setSheet('share')}>
              Share
            </button>
            <button type="button" className={button.ghost} onClick={() => setSheet('settings')}>
              Edit
            </button>
          </div>
        </div>
      </header>

      <div role="tablist" aria-label="Group sections" className="mt-5 flex gap-1 rounded-xl border-2 border-edge bg-paper p-1 shadow-[3px_3px_0_var(--drop)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="tab-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              // Arrow keys move between tabs, as screen reader users expect
              const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
              if (!step) return
              const next = TABS[(TABS.indexOf(t) + step + TABS.length) % TABS.length]
              setTab(next)
              document.getElementById(`tab-${next}`)?.focus()
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-pop text-[#1c1b19] ring-2 ring-edge' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <section role="tabpanel" id="tab-panel" aria-labelledby={`tab-${tab}`} className="mt-4">
        {tab === 'Expenses' && <ExpenseList group={group} />}
        {tab === 'Balances' && <BalancesPanel group={group} />}
        {tab === 'Members' && <MembersPanel group={group} />}
      </section>

      <EditGroupSheet group={group} open={sheet === 'settings'} onClose={() => setSheet(null)} />
      <Sheet open={sheet === 'share'} onClose={() => setSheet(null)} title={`Share ${group.name}`}>
        <ShareGroup group={group} />
      </Sheet>
    </main>
  )
}

function MembersPanel({ group }: { group: Group }) {
  const addMember = useGroups((s) => s.addMember)
  const removeMember = useGroups((s) => s.removeMember)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [styling, setStyling] = useState<Member | null>(null)
  const balances = computeBalances(group)

  function add(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setMessage('Enter a name.')
    if (group.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return setMessage(`${trimmed} is already in this group.`)
    }
    addMember(group.id, trimmed)
    setName('')
    setMessage('')
  }

  return (
    <div className="space-y-4">
      <ul className={`${card} divide-y divide-line`}>
        {group.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              aria-label={`Change ${m.name}'s avatar`}
              onClick={() => setStyling(m)}
              className="relative rounded-full transition hover:scale-105"
            >
              <Avatar member={m} size={36} />
              <span aria-hidden="true" className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border border-edge bg-pop text-[9px] text-[#1c1b19]">
                ✎
              </span>
            </button>
            <span className="flex-1 font-medium">
              {m.name}
              {m.id === group.meId && <span className="ml-2 text-xs text-ink-soft">(you)</span>}
              <span className={`block text-xs ${balances[m.id] > 0 ? 'text-owed' : balances[m.id] < 0 ? 'text-owes' : 'text-ink-soft'}`}>
                {balances[m.id] > 0 ? 'gets back ' : balances[m.id] < 0 ? 'owes ' : 'settled'}
                {balances[m.id] !== 0 && <Money paise={Math.abs(balances[m.id])} />}
              </span>
            </span>
            <button
              type="button"
              className={button.ghost}
              aria-label={`Remove ${m.name}`}
              onClick={() => setMessage(removeMember(group.id, m.id) ?? `${m.name} removed.`)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a friend"
          aria-label="New member name"
        />
        <button type="submit" className={button.secondary}>
          Add
        </button>
      </form>
      {message && (
        <p role="status" className="text-sm text-ink-soft">
          {message}
        </p>
      )}
      {styling && (
        <Suspense fallback={null}>
          <AvatarPicker groupId={group.id} member={styling} onClose={() => setStyling(null)} />
        </Suspense>
      )}
    </div>
  )
}

function EditGroupSheet({ group, open, onClose }: { group: Group; open: boolean; onClose: () => void }) {
  const renameGroup = useGroups((s) => s.renameGroup)
  const deleteGroup = useGroups((s) => s.deleteGroup)
  const [name, setName] = useState(group.name)

  function save(event: FormEvent) {
    event.preventDefault()
    if (name.trim()) renameGroup(group.id, name.trim())
    onClose()
  }

  function remove() {
    // ponytail: native confirm for now; swap for an undo toast during polish
    if (!window.confirm(`Delete “${group.name}” and all its expenses? This can’t be undone.`)) return
    deleteGroup(group.id)
    navigate()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Group settings">
      <form onSubmit={save} className="space-y-4">
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} aria-label="Group name" />
        <button type="submit" className={`${button.primary} w-full`}>
          Save
        </button>
        <button type="button" className={`${button.danger} w-full`} onClick={remove}>
          Delete group
        </button>
      </form>
    </Sheet>
  )
}
