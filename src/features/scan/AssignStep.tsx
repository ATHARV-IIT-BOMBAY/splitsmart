import { useEffect, useRef, useState } from 'react'
import { Avatar, Field, Money } from '../../components/ui'
import { button, card, input } from '../../components/styles'
import { parseRupees } from '../../core/money'
import { computeShares } from '../../core/split'
import { CATEGORIES, CATEGORY_EMOJI } from '../../core/categories'
import type { Category, Expense, Group, MemberId } from '../../core/types'
import { categorizeReceipt, rememberCategory, type ModelProgress } from '../../lib/categorize'
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
  const [title, setTitle] = useState(editing?.title ?? draft.shop ?? '')
  const [payer, setPayer] = useState<MemberId>(
    (editing && Object.keys(editing.paidBy)[0]) ?? group.meId ?? memberIds[0],
  )
  const [date, setDate] = useState(editing?.date ?? today())
  const [showProblems, setShowProblems] = useState(false)
  const [sorting, setSorting] = useState<'working' | 'done' | 'failed'>(() =>
    draft.items.some((i) => !i.category) ? 'working' : 'done',
  )
  const [download, setDownload] = useState<ModelProgress | null>(null)

  // Keep the latest draft for the async model result without re-running it
  const latest = useRef({ draft, onChange })
  useEffect(() => {
    latest.current = { draft, onChange }
  })

  // Sort items into categories with the on-device model (loads on first use)
  useEffect(() => {
    if (sorting !== 'working') return
    const names = latest.current.draft.items.map((i) => i.name)
    let live = true
    categorizeReceipt(names, setDownload)
      .then((categories) => {
        if (!live) return
        const { draft: now, onChange: update } = latest.current
        const byName = new Map(names.map((name, i) => [name, categories[i]]))
        // Only fill in items the user hasn't categorised meanwhile
        update({ ...now, items: now.items.map((i) => (i.category ? i : { ...i, category: byName.get(i.name) ?? 'Other' })) })
        setSorting('done')
      })
      .catch(() => live && setSorting('failed'))
    return () => {
      live = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const meta = { id, title, date, payer, usePrinted }
  const { expense, problems } = draftToExpense(draft, meta)
  const unassigned = draft.items.filter((i) => i.assignees.length === 0).length

  // Live preview: split only what's assigned so far. Once everything is assigned,
  // include the gap to the printed total too, so the shares add up to the Save amount.
  let preview: Record<string, number> = {}
  const assigned = { ...draft, items: draft.items.filter((i) => i.assignees.length > 0) }
  if (assigned.items.some((i) => (parseRupees(i.total) ?? 0) > 0)) {
    try {
      preview = computeShares(draftToExpense(assigned, { ...meta, usePrinted: usePrinted && unassigned === 0 }).expense, memberIds)
    } catch {
      preview = {}
    }
  }

  function setCategory(itemId: string, name: string, category: Category) {
    rememberCategory(name, category)
    onChange({ ...draft, items: draft.items.map((i) => (i.id === itemId ? { ...i, category } : i)) })
  }

  const setAssignees = (itemId: string, assignees: MemberId[]) =>
    onChange({ ...draft, items: draft.items.map((i) => (i.id === itemId ? { ...i, assignees } : i)) })

  function save() {
    if (problems.length > 0) return setShowProblems(true)
    onSave(expense)
  }

  return (
    <div className="space-y-5 pb-44">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold">Who had what?</h2>
        {unassigned > 0 && (
          <button
            type="button"
            className="rounded-full border-2 border-edge bg-pop px-3 py-1 text-xs font-semibold text-[#1c1b19]"
            onClick={() => onChange({ ...draft, items: draft.items.map((i) => (i.assignees.length ? i : { ...i, assignees: memberIds })) })}
          >
            {unassigned === draft.items.length ? 'Everyone shared everything' : `Everyone shared the other ${unassigned}`}
          </button>
        )}
      </div>
      <p className="text-xs text-ink-soft" role="status" aria-live="polite">
        {sorting === 'working'
          ? download && download.total > 0 && download.loaded < download.total
            ? `🧠 Getting the category AI ready, first time only (${(download.loaded / 1e6).toFixed(0)} of ${(download.total / 1e6).toFixed(0)} MB)…`
            : '🧠 Sorting items into categories…'
          : sorting === 'done'
            ? '🧠 Categories by on-device AI. Tap one to change it.'
            : 'Couldn’t load the category AI. Pick categories yourself.'}
      </p>

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
              <select
                value={item.category ?? ''}
                onChange={(e) => setCategory(item.id, item.name, e.target.value as Category)}
                aria-label={`Category for ${item.name}`}
                className="mt-1.5 rounded-full border-2 border-edge bg-page px-2 py-0.5 text-xs font-semibold text-ink"
              >
                {!item.category && <option value="">{sorting === 'working' ? 'Sorting…' : 'Category'}</option>}
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_EMOJI[c]} {c}
                  </option>
                ))}
              </select>
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
              {empty && <p className="mt-1 text-xs text-owes">Assign to someone</p>}
            </li>
          )
        })}
      </ul>

      <section aria-label="Bill details" className={`${card} grid gap-3 p-4 sm:grid-cols-3`}>
        <Field label="What was it?">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={draft.shop ?? 'Night canteen order'} />
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
      </section>

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
