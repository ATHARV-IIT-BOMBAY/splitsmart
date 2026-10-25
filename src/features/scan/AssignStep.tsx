import { useState } from 'react'
import { Avatar, Field, Money } from '../../components/ui'
import { button, card, input } from '../../components/styles'
import { parseRupees } from '../../core/money'
import { computeShares } from '../../core/split'
import type { Expense, Group, MemberId } from '../../core/types'
import { today } from '../expenses/draft'
import { draftToExpense, splitIntoUnits, type ScanDraft } from './draft'

/** Tap avatars to say who had each item; totals per person update live. */
export function AssignStep({
  group,
  draft,
  usePrinted,
  onChange,
  onSave,
  editing,
}: {
  group: Group
  draft: ScanDraft
  usePrinted: boolean
  onChange: (draft: ScanDraft) => void
  onSave: (expense: Expense) => void
  /** Set when re-assigning a receipt that was already saved. */
  editing?: Expense
}) {
  const memberIds = group.members.map((m) => m.id)
  const [id] = useState(() => editing?.id ?? crypto.randomUUID())
  const [title, setTitle] = useState(editing?.title ?? '')
  const [payer, setPayer] = useState<MemberId>(
    (editing && Object.keys(editing.paidBy)[0]) ?? group.meId ?? memberIds[0],
  )
  const [date, setDate] = useState(editing?.date ?? today())
  const [showProblems, setShowProblems] = useState(false)

  const meta = { id, title, date, payer, usePrinted }
  const { expense, problems } = draftToExpense(draft, meta)
  const unassigned = draft.items.filter((i) => i.assignees.length === 0).length

  // Live preview: split only what's assigned so far.
  let preview: Record<string, number> = {}
  const assigned = { ...draft, items: draft.items.filter((i) => i.assignees.length > 0) }
  if (assigned.items.some((i) => (parseRupees(i.total) ?? 0) > 0)) {
    try {
      preview = computeShares(draftToExpense(assigned, { ...meta, usePrinted: false }).expense, memberIds)
    } catch {
      preview = {}
    }
  }

  const setAssignees = (itemId: string, assignees: MemberId[]) =>
    onChange({ ...draft, items: draft.items.map((i) => (i.id === itemId ? { ...i, assignees } : i)) })

  function save() {
    if (problems.length > 0) return setShowProblems(true)
    onSave(expense)
  }

  return (
    <div className="space-y-5 pb-44">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="What was it?">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Night canteen order" />
        </Field>
        <Field label="Paid by">
          <select className={input} value={payer} onChange={(e) => setPayer(e.target.value)}>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === group.meId ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Who had what?</h2>
        {unassigned > 0 && <span className="text-sm text-owes">{unassigned} not assigned yet</span>}
      </div>

      <ul className="space-y-2">
        {draft.items.map((item) => {
          const qty = Number(item.qty)
          const empty = item.assignees.length === 0
          return (
            <li key={item.id} className={`${card} px-4 py-3 ${empty ? 'border-dashed border-owes/50' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {item.name}
                  {qty > 1 && <span className="font-normal text-ink-soft"> × {qty}</span>}
                </span>
                <Money paise={parseRupees(item.total) ?? 0} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {group.members.map((m) => {
                  const on = item.assignees.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${m.name} had ${item.name}`}
                      onClick={() => {
                        navigator.vibrate?.(10)
                        setAssignees(item.id, on ? item.assignees.filter((a) => a !== m.id) : memberIds.filter((a) => a === m.id || item.assignees.includes(a)))
                      }}
                      className={`rounded-full p-0.5 transition active:scale-90 ${on ? 'ring-2 ring-accent' : 'opacity-35 grayscale hover:opacity-70'}`}
                    >
                      <Avatar member={m} size={34} />
                    </button>
                  )
                })}
                <button type="button" className={button.ghost} onClick={() => setAssignees(item.id, empty ? memberIds : [])}>
                  {empty ? 'Everyone' : 'Clear'}
                </button>
                {Number.isInteger(qty) && qty > 1 && qty <= 20 && (
                  <button
                    type="button"
                    className={button.ghost}
                    onClick={() => onChange({ ...draft, items: draft.items.flatMap((i) => (i.id === item.id ? splitIntoUnits(i) : [i])) })}
                  >
                    Split into {qty}
                  </button>
                )}
              </div>
              {empty && <p className="mt-1 text-xs text-owes">Tap who had this</p>}
            </li>
          )
        })}
      </ul>

      {showProblems && problems.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-owes/40 bg-owes/10 p-3 text-sm text-owes">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {/* Live per-person totals, pinned to the bottom of the screen */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <ul className="flex flex-1 justify-around gap-3 overflow-x-auto sm:justify-start" aria-label="Each person’s share so far">
            {group.members.map((m) => (
              <li key={m.id} className="flex shrink-0 flex-col items-center text-xs">
                <Avatar member={m} size={26} />
                <Money paise={preview[m.id] ?? 0} className="mt-0.5" />
              </li>
            ))}
          </ul>
          <button type="button" className={`${button.primary} w-full sm:w-auto`} onClick={save}>
            Save · <Money paise={expense.amountPaise} />
          </button>
        </div>
      </div>
    </div>
  )
}
