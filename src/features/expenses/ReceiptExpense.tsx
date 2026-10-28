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
  const sharers = group.members.filter((m) => people[m.id])
  const itemsTotal = sharers.reduce((sum, m) => sum + people[m.id].itemsPaise, 0)
  const chargesTotal = sharers.reduce((sum, m) => sum + people[m.id].chargesPaise, 0)
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
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-soft">
              <th className="px-4 py-2 font-medium">Person</th>
              <th className="px-2 py-2 text-right font-medium">Items</th>
              <th className="px-2 py-2 text-right font-medium">Tax & charges</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {sharers.map((m) => {
              const p = people[m.id]
              return (
                <tr key={m.id} className="border-b border-dashed border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-semibold">
                      <Avatar member={m} size={26} />
                      {nameOf(m.id)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Money paise={p.itemsPaise} />
                  </td>
                  <td className="px-2 py-2.5 text-right text-ink-soft">
                    <Money paise={p.chargesPaise} />
                    {itemsTotal > 0 && chargesTotal !== 0 && (
                      <span className="block text-[11px]">{Math.round((p.itemsPaise / itemsTotal) * 1000) / 10}% of charges</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Money paise={p.totalPaise} className="font-bold" />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-edge font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-2 py-2 text-right">
                <Money paise={itemsTotal} />
              </td>
              <td className="px-2 py-2 text-right">
                <Money paise={chargesTotal} />
              </td>
              <td className="px-4 py-2 text-right">
                <Money paise={expense.amountPaise} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Tax and charges are shared in proportion to what each person had, and every share is exact to the paisa. Leftover paise from
        rounding go to whoever paid first.
      </p>

      <h2 className="mb-2 mt-6 font-bold">Who had what</h2>
      <ul className="space-y-2">
        {sharers.map((m) => {
          const p = people[m.id]
          return (
            <li key={m.id}>
              <details className={`${card} group px-4 py-3`}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <Avatar member={m} size={30} />
                  <span className="flex-1 font-semibold">{nameOf(m.id)}</span>
                  <span className="text-sm text-ink-soft">
                    {p.items.length} {p.items.length === 1 ? 'item' : 'items'}
                  </span>
                  <span aria-hidden="true" className="text-ink-soft transition group-open:rotate-90">
                    ›
                  </span>
                </summary>
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
                </ul>
              </details>
            </li>
          )
        })}
      </ul>

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
