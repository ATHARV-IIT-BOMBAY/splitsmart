import { useMemo, useState, type FormEvent } from 'react'
import { Avatar, Money, Sheet } from '../../components/ui'
import { button, card, input } from '../../components/styles'
import { MEMBER_COLORS } from '../../core/members'
import type { Group, Member } from '../../core/types'
import { AVATAR_STYLES, avatarUri, type AvatarStyle } from '../../lib/avatars.ts'
import { href, navigate } from '../../lib/router'
import { useGroup, useGroups } from '../../store/groups'
import { BalancesPanel } from '../balances/BalancesPanel'
import { ExpenseList } from '../expenses/ExpenseList'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const TABS = ['Expenses', 'Balances', 'Members'] as const
type Tab = (typeof TABS)[number]



const SEEDS = ['Mia', 'Leo', 'Zoe', 'Kai', 'Ava', 'Rio', 'Ivy', 'Max', 'Nia', 'Sam', 'Tia', 'Dev']

export function GroupPage({ groupId }: { groupId: string }) {
  const group = useGroup(groupId)
  const [tab, setTab] = useState<Tab>('Expenses')
  const [editing, setEditing] = useState(false)

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
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
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
          <button type="button" className={button.ghost} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      </header>

      <div role="tablist" aria-label="Group sections" className="mt-5 flex gap-1 rounded-xl border-2 border-edge bg-paper p-1 shadow-[3px_3px_0_var(--drop)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-pop text-[#1c1b19] ring-2 ring-edge' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <section role="tabpanel" aria-label={tab} className="mt-4">
        {tab === 'Expenses' && <ExpenseList group={group} />}
        {tab === 'Balances' && <BalancesPanel group={group} />}
        {tab === 'Members' && <MembersPanel group={group} />}
      </section>

      <EditGroupSheet group={group} open={editing} onClose={() => setEditing(false)} />
    </main>
  )
}

function MembersPanel({ group }: { group: Group }) {
  const addMember = useGroups((s) => s.addMember)
  const removeMember = useGroups((s) => s.removeMember)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [styling, setStyling] = useState<Member | null>(null)

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
            {m.id === group.meId ? (
              <button
                type="button"
                aria-label="Change your avatar"
                onClick={() => setStyling(m)}
                className="cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Avatar member={m} size={36} />
              </button>
            ) : (
              <Avatar member={m} size={36} />
            )}
            <span className="flex-1 font-medium">
              {m.name}
              {m.id === group.meId && <span className="ml-2 text-xs text-ink-soft">(you)</span>}
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
      {styling && <MemberStyleSheet groupId={group.id} member={styling} onClose={() => setStyling(null)} />}
    </div>
  )
}

function MemberStyleSheet({ groupId, member, onClose }: { groupId: string; member: Member; onClose: () => void }) {
  const updateMember = useGroups((s) => s.updateMember)
  const [color, setColor] = useState(member.color)
  const [avatar, setAvatar] = useState(member.avatar)
  const [style, setStyle] = useState<AvatarStyle>(member.avatar?.style ?? 'adventurer')

  const options = useMemo(() => SEEDS.map((seed) => ({ seed, uri: avatarUri(style, seed) })), [style])

  function save() {
    updateMember(groupId, member.id, { color, avatar })
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={`${member.name}’s avatar`}>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto text-ink">
        <div className="flex justify-center" aria-hidden="true">
          <Avatar member={{ ...member, color, avatar }} size={72} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Characters</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(AVATAR_STYLES) as AvatarStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={style === s}
                onClick={() => setStyle(s)}
                className={`cursor-pointer rounded-full border border-line px-3 py-1 text-sm ${
                  style === s ? 'bg-accent text-white' : 'bg-paper text-ink'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {options.map(({ seed, uri }) => {
              const selected = avatar?.style === style && avatar.seed === seed
              return (
                <button
                  key={seed}
                  type="button"
                  aria-label={`Character ${seed}`}
                  aria-pressed={selected}
                  onClick={() => setAvatar({ style, seed })}
                  style={{ backgroundColor: color }}
                  className={`aspect-square cursor-pointer overflow-hidden rounded-full border border-line ${
                    selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''
                  }`}
                >
                  <img src={uri} alt="" className="block h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Colour</p>
          <div className="flex flex-wrap gap-2">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-9 w-9 cursor-pointer rounded-full border border-line ${
                  color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <button type="button" className={`${button.primary} w-full`} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
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
    <Sheet open={open} onClose={onClose} title="Edit group">
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