import type { ReactNode } from 'react'
import { Avatar, Money } from '../../components/ui'
import { card } from '../../components/styles'
import { CATEGORY_EMOJI } from '../../core/categories'
import { formatINR, type Paise } from '../../core/money'
import { spending, spendingOverTime } from '../../core/spending'
import type { Group } from '../../core/types'

interface Row {
  key: string
  label: ReactNode
  paise: Paise
  /** Bar colour: a member's own colour, so charts match their avatar. */
  color?: string
}

/** Where the group's money went: by category, by person and over time. */
export function SpendingPanel({ group }: { group: Group }) {
  const { total, byCategory, byPerson } = spending(group)
  if (total === 0) return null
  const member = (id: string) => group.members.find((m) => m.id === id)
  const { unit, periods } = spendingOverTime(group)

  return (
    <section aria-labelledby="spending-heading">
      <h2 id="spending-heading" className="mb-2 font-bold">
        Spending · <Money paise={total} />
      </h2>
      <div className={`${card} grid gap-6 p-4 sm:grid-cols-2`}>
        <Bars
          title="By category"
          total={total}
          rows={byCategory.map(([c, paise]) => ({ key: c, label: `${CATEGORY_EMOJI[c] ?? '📦'} ${c}`, paise }))}
        />
        <Bars
          title="By person"
          total={total}
          rows={byPerson.map(([id, paise]) => {
            const m = member(id)
            return {
              key: id,
              paise,
              color: m?.color,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {m && <Avatar member={m} size={20} />}
                  {id === group.meId ? 'You' : (m?.name ?? 'Someone')}
                </span>
              ),
            }
          })}
        />
        {periods.length > 1 && (
          <div className="sm:col-span-2">
            <Columns title={`Over time, by ${unit}`} periods={periods} />
          </div>
        )}
      </div>
    </section>
  )
}

function Bars({ title, rows, total }: { title: string; rows: Row[]; total: Paise }) {
  const max = rows[0]?.paise ?? 1
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink-soft">{title}</h3>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{row.label}</span>
              <span className="shrink-0">
                <Money paise={row.paise} /> <span className="text-xs text-ink-soft">{Math.round((row.paise / total) * 100)}%</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-line" aria-hidden="true">
              <div
                className="h-full rounded-full border border-edge/40 bg-accent"
                style={{ width: `${Math.max(2, (row.paise / max) * 100)}%`, backgroundColor: row.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const compact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })

/** A column per day/week/month, labelled with its amount when there's room. */
function Columns({ title, periods }: { title: string; periods: ReturnType<typeof spendingOverTime>['periods'] }) {
  const max = Math.max(...periods.map((p) => p.paise), 1)
  // Label every column when there's room, otherwise about six evenly spaced ones
  const every = Math.ceil(periods.length / 6)
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink-soft">{title}</h3>
      <ol className="flex h-40 items-end gap-1 border-b-2 border-edge pb-px" aria-label={title}>
        {periods.map((p) => (
          <li key={p.start} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${p.label}: ${formatINR(p.paise)}`}>
            <span className="sr-only">
              {p.label}: {formatINR(p.paise)}
            </span>
            {periods.length <= 8 && p.paise > 0 && (
              <span aria-hidden="true" className="money mb-0.5 truncate text-center text-[10px] text-ink-soft">
                {compact.format(p.paise / 100)}
              </span>
            )}
            <div
              aria-hidden="true"
              className={`rounded-t-md ${p.paise > 0 ? 'border-2 border-b-0 border-edge bg-accent' : ''}`}
              style={{ height: `${(p.paise / max) * 85}%`, minHeight: p.paise > 0 ? 4 : 0 }}
            />
          </li>
        ))}
      </ol>
      <ol className="mt-1 flex gap-1 text-[10px] text-ink-soft" aria-hidden="true">
        {periods.map((p, i) => (
          <li key={p.start} className="min-w-0 flex-1 truncate text-center">
            {i % every === 0 ? p.label : ''}
          </li>
        ))}
      </ol>
    </div>
  )
}
