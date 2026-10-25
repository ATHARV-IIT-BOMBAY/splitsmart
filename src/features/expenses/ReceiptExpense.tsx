import { useState } from 'react'
import { button, card } from '../../components/styles'
import { Avatar, Money } from '../../components/ui'
import { itemizedBreakdown } from '../../core/split'
import type { Expense, Group } from '../../core/types'
import { href, navigate } from '../../lib/router'
import { useGroups } from '../../store/groups'
import { AssignStep } from '../scan/AssignStep'
import { draftFromExpense } from '../scan/draft'

const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** A saved receipt: who had what, each person's exact share, and how to change it. */
export function ReceiptExpense({ group, expense }: { group: Group; expense: Expense }) {
  const saveExpense = useGroups((s) => s.saveExpense)
  const deleteExpense = useGroups((s) => s.deleteExpense)
  const [draft, setDraft] = useState(() => (expense.split.mode === 'itemized' ? draftFromExpense(expense) : null))
  const [editing, setEditing] = useState(false)

  const people = itemizedBreakdown(
    expense,
    group.members.map((m) => m.id),
  )
  const payerId = Object.keys(expense.paidBy)[0]
  const nameOf = (id: string) => (id === group.meId ? 'You' : (group.members.find((m) => m.id === id)?.name ?? 'Someone'))
  const back = () => navigate('g', group.id)

  function remove() {
    if (!window.confirm(`Delete “${expense.title}”?`)) return
    deleteExpense(group.id, expense.id)
    back()
  }

  if (editing && draft) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <button type="button" className={`${button.ghost} mb-2`} onClick={() => setEditing(false)}>
          ← Back to the split
        </button>
        <AssignStep
          group={group}
          draft={draft}
          usePrinted
          editing={expense}
          onChange={setDraft}
          onSave={(updated) => {
            saveExpense(group.id, updated)
            setEditing(false)
          }}
        />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
      <a href={href('g', group.id)} className={button.ghost}>
        ← {group.name}
      </a>

      <header className={`${card} mt-2 p-5`}>
        <p className="text-sm text-ink-soft">
          {dateLabel.format(new Date(`${expense.date}T00:00`))} · {nameOf(payerId)} paid
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-extrabold leading-tight">{expense.title}</h1>
          <Money paise={expense.amountPaise} className="text-2xl font-bold" />
        </div>
      </header>

      <h2 className="mb-2 mt-6 font-bold">Each person’s share</h2>
      <ul className="space-y-3">
        {group.members
          .filter((m) => people[m.id])
          .map((m) => {
            const p = people[m.id]
            return (
              <li key={m.id} className={`${card} px-4 py-3`}>
                <div className="flex items-center gap-3">
                  <Avatar member={m} size={34} />
                  <span className="flex-1 font-semibold">{nameOf(m.id)}</span>
                  <Money paise={p.totalPaise} className="text-lg font-bold" />
                </div>
                <ul className="mt-2 space-y-0.5 border-t border-dashed border-line pt-2 text-sm text-ink-soft">
                  {p.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        {item.name}
                        {item.sharedWith > 1 && <span> (split {item.sharedWith} ways)</span>}
                      </span>
                      <Money paise={item.paise} />
                    </li>
                  ))}
                  {p.chargesPaise !== 0 && (
                    <li className="flex justify-between gap-3">
                      <span>Tax and charges, by what they had</span>
                      <Money paise={p.chargesPaise} />
                    </li>
                  )}
                </ul>
              </li>
            )
          })}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        Shares add up to exactly <Money paise={expense.amountPaise} />. Leftover paise from rounding go to whoever paid first.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button type="button" className={button.primary} onClick={() => setEditing(true)}>
          Edit who had what
        </button>
        <button type="button" className={button.danger} onClick={remove}>
          Delete expense
        </button>
      </div>
    </main>
  )
}
