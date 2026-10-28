import { Money } from '../../components/ui'
import { card } from '../../components/styles'
import { CATEGORY_EMOJI } from '../../core/categories'
import type { Paise } from '../../core/money'
import { spending } from '../../core/spending'
import type { Group } from '../../core/types'

/** Where the group's money went: by category and by person, as simple bar lists. */
export function SpendingPanel({ group }: { group: Group }) {
  const { total, byCategory, byPerson } = spending(group)
  if (total === 0) return null
  const nameOf = (id: string) => (id === group.meId ? 'You' : group.members.find((m) => m.id === id)?.name ?? 'Someone')

  return (
    <section aria-labelledby="spending-heading">
      <h2 id="spending-heading" className="mb-2 font-bold">
        Spending · <Money paise={total} />
      </h2>
      <div className={`${card} grid gap-5 p-4 sm:grid-cols-2`}>
        <Bars title="By category" rows={byCategory.map(([c, paise]) => [`${CATEGORY_EMOJI[c]} ${c}`, paise])} total={total} />
        <Bars title="By person" rows={byPerson.map(([id, paise]) => [nameOf(id), paise])} total={total} />
      </div>
    </section>
  )
}

function Bars({ title, rows, total }: { title: string; rows: [string, Paise][]; total: Paise }) {
  const max = rows[0]?.[1] ?? 1
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink-soft">{title}</h3>
      <ul className="space-y-2.5">
        {rows.map(([label, paise]) => (
          <li key={label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{label}</span>
              <span className="shrink-0">
                <Money paise={paise} /> <span className="text-xs text-ink-soft">{Math.round((paise / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (paise / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
