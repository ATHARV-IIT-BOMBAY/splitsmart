import { useState } from 'react'
import { Avatar, Money, Sheet } from '../../components/ui'
import { button, card } from '../../components/styles'
import { computeBalances, directDebtCount } from '../../core/balances'
import { groupToCsv } from '../../core/csv'
import { greedySettle, settleUp, type Transfer } from '../../core/settle'
import type { Group } from '../../core/types'
import { today } from '../expenses/draft'
import { formatINR } from '../../core/money'
import { upiLink } from '../../core/upi'
import { href } from '../../lib/router'
import { shareText } from '../../lib/share'
import { useGroups } from '../../store/groups'
import { PaymentCard } from './PaymentCard'
import { SpendingPanel } from './SpendingPanel'

/** Download the group's expenses as a CSV file that opens cleanly in Excel and Google Sheets. */
function downloadCsv(group: Group) {
  // The leading BOM makes Excel read the file as UTF-8, so ₹ doesn't turn into garbage
  const blob = new Blob(['\uFEFF' + groupToCsv(group)], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${group.name.replace(/[\\/:*?"<>|]/g, '_')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari cancels the download if the URL is revoked straight away
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BalancesPanel({ group }: { group: Group }) {
  const addSettlement = useGroups((s) => s.addSettlement)
  const deleteSettlement = useGroups((s) => s.deleteSettlement)
  const balances = computeBalances(group)
  const transfers = settleUp(balances)
  const iouCount = directDebtCount(group)
  const greedyCount = greedySettle(balances).length
  const biggest = Math.max(...Object.values(balances).map(Math.abs), 1)
  const [stamping, setStamping] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)
  const member = (id: string) => group.members.find((m) => m.id === id)
  const nameOf = (id: string) => (id === group.meId ? 'You' : member(id)?.name ?? 'Someone')
  const keyOf = (t: Transfer) => `${t.from}-${t.to}`

  /** The whole settle-up as one WhatsApp message, with UPI links where we have them. */
  function shareSummary() {
    const lines = transfers.map((t) => {
      const to = member(t.to)
      const link = to?.upiId ? upiLink({ upiId: to.upiId, name: to.name, paise: t.paise, note: `SplitSmart ${group.name}` }) : ''
      return `• ${member(t.from)?.name} → ${to?.name}: ${formatINR(t.paise)}${link ? `\n  ${link}` : ''}`
    })
    void shareText([`🧾 ${group.name}: settle up`, ...lines, `${transfers.length} payments settle everything. Sent from SplitSmart`].join('\n'))
  }

  // Let the PAID stamp land before the payment moves to "Payments made"
  function markPaid(t: Transfer) {
    navigator.vibrate?.(20)
    setStamping(keyOf(t))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => {
      addSettlement(group.id, { ...t, date: today() })
      setStamping(null)
    }, reduced ? 0 : 650)
  }

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
                <span className="flex-1 font-medium">
                  {nameOf(m.id)}
                  {/* Who's up and who's down, at a glance */}
                  <span aria-hidden="true" className="mt-1 flex h-1.5 w-full max-w-40">
                    <span className="flex flex-1 justify-end">
                      {b < 0 && <span className="h-full rounded-l-full bg-owes" style={{ width: `${(-b / biggest) * 100}%` }} />}
                    </span>
                    <span className="w-px bg-line" />
                    <span className="flex-1">
                      {b > 0 && <span className="block h-full rounded-r-full bg-owed" style={{ width: `${(b / biggest) * 100}%` }} />}
                    </span>
                  </span>
                </span>
                <span className={`text-right text-sm ${b > 0 ? 'text-owed' : b < 0 ? 'text-owes' : 'text-ink-soft'}`}>
                  {b === 0 ? (
                    'settled'
                  ) : (
                    <>
                      {m.id === group.meId ? (b > 0 ? 'get back ' : 'owe ') : b > 0 ? 'gets back ' : 'owes '}
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
          <div className={`${card} relative overflow-hidden px-4 py-6 text-center`}>
            {group.settlements.length > 0 && <Confetti />}
            <p className="text-3xl" aria-hidden="true">
              {group.settlements.length > 0 ? '🎉' : '🤝'}
            </p>
            <p className="mt-1 font-bold">{group.settlements.length > 0 ? 'All square!' : 'All settled up'}</p>
            <p className="text-sm text-ink-soft">Nothing to pay.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              {iouCount > transfers.length && (
                <span className="rounded-full border-2 border-edge bg-paper px-3 py-1 font-semibold">
                  <span className="text-ink-soft line-through">{iouCount} IOUs</span> → {transfers.length}{' '}
                  {transfers.length === 1 ? 'payment' : 'payments'}
                </span>
              )}
              <button
                type="button"
                className="rounded-full border-2 border-edge bg-pop px-3 py-1 font-semibold text-[#1c1b19]"
                onClick={() => setExplaining(true)}
              >
                ✓ Proven minimum · Why?
              </button>
              {greedyCount > transfers.length && (
                <span className="text-ink-soft">
                  The usual shortcut needs {greedyCount}; this needs {transfers.length}.
                </span>
              )}
              <button type="button" className={`${button.ghost} ml-auto`} onClick={shareSummary}>
                Share on WhatsApp
              </button>
            </div>
            <ul className="space-y-2">
              {transfers.map((t) => (
                <PaymentCard
                  key={keyOf(t)}
                  group={group}
                  transfer={t}
                  stamping={stamping === keyOf(t)}
                  onMarkPaid={() => markPaid(t)}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <a href={href('g', group.id, 'report')} className={button.secondary}>
          Report (PDF)
        </a>
        <button type="button" className={button.secondary} onClick={() => downloadCsv(group)}>
          Download CSV
        </button>
      </div>

      {group.settlements.length > 0 && (
        <section aria-labelledby="paid-heading">
          <h2 id="paid-heading" className="mb-2 font-bold">
            Payments made
          </h2>
          <ul className={`${card} divide-y divide-line`}>
            {group.settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="stamp-static" aria-hidden="true">
                  PAID
                </span>
                <span className="flex-1">
                  {nameOf(s.from)} paid {s.to === group.meId ? 'you' : nameOf(s.to)} <Money paise={s.paise} />
                </span>
                <button type="button" className={button.ghost} onClick={() => deleteSettlement(group.id, s.id)}>
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SpendingPanel group={group} />

      <Sheet open={explaining} onClose={() => setExplaining(false)} title="Why this is the fewest">
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Only each person’s <strong>net balance</strong> matters. If people can be split into groups whose balances cancel out, each
            group of <em>k</em> people settles in <em>k − 1</em> payments.
          </p>
          <p>
            So the fewest payments is <strong>people − groups</strong>, and the trick is finding the most such groups. SplitSmart tries
            every way of grouping people (a bitmask search over all subsets), so the answer is the true minimum, not a guess.
          </p>
          <p className="rounded-xl bg-page p-3">
            Example: +600, +400, −300, −300, −400. The usual shortcut (biggest debt pays biggest credit) needs 4 payments. Grouping
            {' {+400, −400}'} and {'{+600, −300, −300}'} needs only 3.
          </p>
        </div>
      </Sheet>
    </div>
  )
}

/** A short burst of paper confetti when the last debt is paid. */
function Confetti() {
  const colors = ['var(--accent)', 'var(--pop)', 'var(--owed)', '#c9d7f8', '#f7c8dd']
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{ left: `${(i * 41) % 100}%`, backgroundColor: colors[i % colors.length], animationDelay: `${(i % 6) * 80}ms` }}
        />
      ))}
    </span>
  )
}
