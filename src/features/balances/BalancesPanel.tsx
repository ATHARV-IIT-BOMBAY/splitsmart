import { Avatar, Money } from '../../components/ui'
import { button, card } from '../../components/styles'
import { computeBalances } from '../../core/balances'
import { settleUp } from '../../core/settle'
import type { Group } from '../../core/types'
import { today } from '../expenses/draft'
import { useGroups } from '../../store/groups'

export function BalancesPanel({ group }: { group: Group }) {
  const addSettlement = useGroups((s) => s.addSettlement)
  const deleteSettlement = useGroups((s) => s.deleteSettlement)
  const balances = computeBalances(group)
  const transfers = settleUp(balances)
  const member = (id: string) => group.members.find((m) => m.id === id)
  const nameOf = (id: string) => (id === group.meId ? 'You' : member(id)?.name ?? 'Someone')

  return (
    <div className="space-y-6">
      <section aria-labelledby="balances-heading">
        <h2 id="balances-heading" className="mb-2 font-bold">
          Balances
        </h2>
        <ul className={`${card} divide-y divide-line`}>
          {group.members.map((m) => {
            const b = balances[m.id] ?? 0
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar member={m} />
                <span className="flex-1 font-medium">{nameOf(m.id)}</span>
                <span className={`text-right text-sm ${b > 0 ? 'text-owed' : b < 0 ? 'text-owes' : 'text-ink-soft'}`}>
                  {b === 0 ? (
                    'settled'
                  ) : (
                    <>
                      {b > 0 ? 'gets back ' : 'owes '}
                      <Money paise={Math.abs(b)} className="font-semibold" />
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="settle-heading">
        <h2 id="settle-heading" className="mb-1 font-bold">
          Settle up
        </h2>
        {transfers.length === 0 ? (
          <p className={`${card} px-4 py-6 text-center text-ink-soft`}>Everyone’s square. Nothing to pay.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-ink-soft">
              {transfers.length} {transfers.length === 1 ? 'payment settles' : 'payments settle'} everything. That’s the
              fewest possible.
            </p>
            <ul className="space-y-2">
              {transfers.map((t) => {
                const from = member(t.from)
                const to = member(t.to)
                return (
                  <li key={`${t.from}-${t.to}`} className={`${card} flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3`}>
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {from && <Avatar member={from} />}
                      <span className="text-ink-soft">→</span>
                      {to && <Avatar member={to} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{nameOf(t.from)}</span>
                      <span className="text-ink-soft"> pays </span>
                      <span className="font-medium">{nameOf(t.to)}</span>
                    </span>
                    <Money paise={t.paise} className="text-lg font-semibold" />
                    <button
                      type="button"
                      className={`${button.secondary} w-full sm:w-auto`}
                      onClick={() => addSettlement(group.id, { ...t, date: today() })}
                    >
                      Mark paid
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {group.settlements.length > 0 && (
        <section aria-labelledby="paid-heading">
          <h2 id="paid-heading" className="mb-2 font-bold">
            Payments made
          </h2>
          <ul className={`${card} divide-y divide-line`}>
            {group.settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1">
                  {nameOf(s.from)} paid {nameOf(s.to)} <Money paise={s.paise} />
                </span>
                <button type="button" className={button.ghost} onClick={() => deleteSettlement(group.id, s.id)}>
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
