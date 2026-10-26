import { Money } from '../../components/ui'
import { button, card } from '../../components/styles'
import { CATEGORY_EMOJI } from '../../core/categories'
import { computeShares } from '../../core/split'
import type { Group } from '../../core/types'
import { href } from '../../lib/router'

const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

export function ExpenseList({ group }: { group: Group }) {
  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? 'Someone'
  const memberOrder = group.members.map((m) => m.id)
  // Newest first; expenses on the same day keep the order they were added.
  const expenses = group.expenses
    .map((expense, index) => ({ expense, index }))
    .sort((a, b) => b.expense.date.localeCompare(a.expense.date) || b.index - a.index)
    .map(({ expense }) => expense)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <a href={href('g', group.id, 'scan')} className={button.primary}>
          Scan receipt
        </a>
        <a href={href('g', group.id, 'expense', 'new')} className={button.secondary}>
          + Add manually
        </a>
      </div>

      {expenses.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">No expenses yet. Add the first one.</p>
      ) : (
        <ul className={`${card} divide-y divide-line`}>
          {expenses.map((e) => {
            const payers = Object.keys(e.paidBy).map(nameOf).join(' + ')
            const myShare = group.meId ? computeShares(e, memberOrder)[group.meId] ?? 0 : 0
            return (
              <li key={e.id}>
                <a href={href('g', group.id, 'expense', e.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-page">
                  <span className="w-12 shrink-0 text-center text-xs uppercase text-ink-soft">
                    {dateLabel.format(new Date(`${e.date}T00:00`))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {e.category && (
                        <span title={e.category} aria-label={e.category} className="mr-1.5">
                          {CATEGORY_EMOJI[e.category]}
                        </span>
                      )}
                      {e.title}
                    </span>
                    <span className="block text-sm text-ink-soft">{payers} paid</span>
                  </span>
                  <span className="text-right">
                    <Money paise={e.amountPaise} className="block font-medium" />
                    {group.meId && (
                      <span className="block text-xs text-ink-soft">
                        your share <Money paise={myShare} />
                      </span>
                    )}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
