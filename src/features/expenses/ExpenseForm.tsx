import { useState, type FormEvent } from 'react'
import { CATEGORIES, CATEGORY_EMOJI } from '../../core/categories'
import { categorize, rememberCategory } from '../../lib/categorize'
import { Avatar, Field, Money } from '../../components/ui'
import { button, card, input, inputBase } from '../../components/styles'
import { computeShares } from '../../core/split'
import type { Category, Group } from '../../core/types'
import { href, navigate } from '../../lib/router'
import { useGroup, useGroups } from '../../store/groups'
import { ReceiptExpense } from './ReceiptExpense'
import { draftFromExpense, draftToExpense, newDraft, remainingLabel, type Draft, type ManualMode } from './draft'

const MODES: { mode: ManualMode; label: string }[] = [
  { mode: 'equal', label: 'Equally' },
  { mode: 'exact', label: 'Exact ₹' },
  { mode: 'percent', label: 'Percent' },
  { mode: 'shares', label: 'Shares' },
]

export function ExpenseForm({ groupId, expenseId }: { groupId: string; expenseId?: string }) {
  const group = useGroup(groupId)
  const existing = group?.expenses.find((e) => e.id === expenseId)

  if (!group || (expenseId && !existing)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">This expense doesn’t exist on this device.</p>
        <a href={group ? href('g', groupId) : href()} className={`${button.secondary} mt-4`}>
          Go back
        </a>
      </main>
    )
  }
  if (existing?.split.mode === 'itemized') return <ReceiptExpense group={group} expense={existing} />
  return <Form group={group} expenseId={expenseId} />
}

function Form({ group, expenseId }: { group: Group; expenseId?: string }) {
  const saveExpense = useGroups((s) => s.saveExpense)
  const deleteExpense = useGroups((s) => s.deleteExpense)
  const memberIds = group.members.map((m) => m.id)
  const existing = group.expenses.find((e) => e.id === expenseId)

  const [draft, setDraft] = useState<Draft>(() =>
    existing ? draftFromExpense(existing, memberIds) : newDraft(memberIds, group.meId ?? memberIds[0]),
  )
  const [showProblems, setShowProblems] = useState(false)
  const [suggested, setSuggested] = useState(false)
  const [id] = useState(() => expenseId ?? crypto.randomUUID())

  const nameOf = (memberId: string) => group.members.find((m) => m.id === memberId)?.name ?? 'Someone'
  const { expense, problems } = draftToExpense(draft, id, nameOf)
  const preview = problems.length === 0 ? computeShares(expense, memberIds) : null
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const back = () => navigate('g', group.id)

  // After typing a description, let the on-device model suggest a category
  async function suggestCategory() {
    const title = draft.title.trim()
    if (!title || (draft.category && !suggested)) return
    try {
      const [category] = await categorize([title])
      setDraft((d) => (d.title.trim() === title ? { ...d, category } : d))
      setSuggested(true)
    } catch {
      // Model couldn't load (e.g. offline the first time): the user picks it themselves
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (problems.length > 0) return setShowProblems(true)
    saveExpense(group.id, expense)
    back()
  }

  function remove() {
    if (!window.confirm(`Delete “${existing?.title}”?`)) return
    deleteExpense(group.id, id)
    back()
  }

  function toggle(memberId: string) {
    set({
      included: draft.included.includes(memberId)
        ? draft.included.filter((m) => m !== memberId)
        : memberIds.filter((m) => m === memberId || draft.included.includes(m)),
    })
  }

  const remaining = remainingLabel(draft)

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
      <a href={href('g', group.id)} className={button.ghost}>
        ← {group.name}
      </a>
      <h1 className="mb-4 mt-2 text-2xl font-extrabold">{existing ? 'Edit expense' : 'Add expense'}</h1>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Description">
          <input
            className={input}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            onBlur={suggestCategory}
            placeholder="Wi-Fi recharge"
            autoFocus={!existing}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <input
              className={`${input} money`}
              value={draft.amount}
              onChange={(e) => set({ amount: e.target.value })}
              placeholder="840"
              inputMode="decimal"
            />
          </Field>
          <Field label="Date">
            <input className={input} type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>

        <Field label="Category" hint={suggested ? 'Suggested by on-device AI. Change it if it’s wrong.' : undefined}>
          <select
            className={input}
            value={draft.category ?? ''}
            onChange={(e) => {
              const category = e.target.value as Category
              set({ category })
              setSuggested(false)
              if (draft.title.trim()) rememberCategory(draft.title, category)
            }}
          >
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_EMOJI[c]} {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Paid by">
          <select className={input} value={draft.payer} onChange={(e) => set({ payer: e.target.value })}>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === group.meId ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Split</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl border-2 border-edge bg-paper p-1">
            {MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={draft.mode === mode}
                onClick={() => set({ mode, values: {} })}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  draft.mode === mode ? 'bg-pop text-[#1c1b19] ring-2 ring-edge' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className={`${card} mt-3 divide-y divide-line`}>
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar member={m} />
                <span className="flex-1 font-medium">{m.name}</span>
                {draft.mode === 'equal' ? (
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--accent)]"
                    checked={draft.included.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    aria-label={`Include ${m.name}`}
                  />
                ) : (
                  <input
                    className={`${inputBase} money w-24 py-1.5 text-right`}
                    value={draft.values[m.id] ?? ''}
                    onChange={(e) => set({ values: { ...draft.values, [m.id]: e.target.value } })}
                    inputMode={draft.mode === 'shares' ? 'numeric' : 'decimal'}
                    placeholder={draft.mode === 'shares' ? '0' : draft.mode === 'percent' ? '0 %' : '₹0'}
                    aria-label={`${m.name}'s ${draft.mode === 'exact' ? 'amount' : draft.mode}`}
                  />
                )}
                {preview && (
                  <Money paise={preview[m.id] ?? 0} className="w-20 text-right text-sm text-ink-soft" />
                )}
              </li>
            ))}
          </ul>
          {remaining && <p className="mt-2 text-sm text-ink-soft">{remaining}</p>}
        </fieldset>

        {showProblems && problems.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-xl border border-owes/40 bg-owes/10 p-3 text-sm text-owes">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <button type="submit" className={`${button.primary} w-full`}>
          {existing ? 'Save changes' : 'Add expense'}
        </button>
        {existing && (
          <button type="button" className={`${button.danger} w-full`} onClick={remove}>
            Delete expense
          </button>
        )}
      </form>
    </main>
  )
}
