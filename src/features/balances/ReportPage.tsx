import { useState } from 'react'
import { button } from '../../components/styles'
import { computeBalances } from '../../core/balances'
import { formatINR } from '../../core/money'
import { settleUp } from '../../core/settle'
import { href } from '../../lib/router'
import { useGroup } from '../../store/groups'

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateOf = (iso: string) => day.format(new Date(`${iso}T00:00`))

/**
 * A plain settlement statement made for printing. "Save as PDF" uses the
 * browser's own print-to-PDF, which works on phones and laptops alike.
 */
export function ReportPage({ groupId }: { groupId: string }) {
  const group = useGroup(groupId)
  const [madeOn] = useState(() => new Date().toLocaleDateString('en-CA'))
  if (!group) return <main className="py-16 text-center">This group doesn’t exist on this device.</main>

  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? 'Someone'
  const balances = computeBalances(group)
  const transfers = settleUp(balances)
  const spent = group.expenses.reduce((sum, e) => sum + e.amountPaise, 0)
  const expenses = [...group.expenses].sort((a, b) => a.date.localeCompare(b.date))
  const cell = 'border-b border-line px-2 py-1.5 text-left align-top'
  const money = `${cell} money text-right`

  return (
    <main className="report mx-auto max-w-3xl px-4 pb-16 pt-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <a href={href('g', group.id)} className={button.ghost}>
          ← {group.name}
        </a>
        <button type="button" className={`${button.primary} ml-auto`} onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>
      <p className="no-print mb-4 text-sm text-ink-soft">In the print window, choose “Save as PDF” as the printer.</p>

      <header className="mb-6 flex items-end justify-between gap-4 border-b-2 border-edge pb-3">
        <div>
          <p className="text-sm font-bold tracking-wide text-ink-soft">SPLITSMART · SETTLEMENT REPORT</p>
          <h1 className="text-3xl font-extrabold">{group.name}</h1>
        </div>
        <p className="text-right text-sm text-ink-soft">
          {dateOf(madeOn)}
          <br />
          {group.members.map((m) => m.name).join(', ')}
        </p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold">Who pays whom</h2>
        {transfers.length === 0 ? (
          <p>Everyone is settled up. Nothing to pay.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <tbody>
              {transfers.map((t) => {
                const upi = group.members.find((m) => m.id === t.to)?.upiId
                return (
                  <tr key={`${t.from}-${t.to}`}>
                    <td className={cell}>
                      <strong>{nameOf(t.from)}</strong> pays <strong>{nameOf(t.to)}</strong>
                      {upi && <span className="text-ink-soft"> · UPI {upi}</span>}
                    </td>
                    <td className={`${money} font-bold`}>{formatINR(t.paise)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="mt-1 text-xs text-ink-soft">The fewest payments that settle every balance.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold">Balances</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {group.members.map((m) => {
              const b = balances[m.id] ?? 0
              return (
                <tr key={m.id}>
                  <td className={cell}>{m.name}</td>
                  <td className={cell}>{b > 0 ? 'gets back' : b < 0 ? 'owes' : 'settled'}</td>
                  <td className={money}>{b === 0 ? '—' : formatINR(Math.abs(b))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold">
          Expenses · {formatINR(spent)} in total
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-ink-soft">
              <th className={cell}>Date</th>
              <th className={cell}>What</th>
              <th className={cell}>Paid by</th>
              <th className={`${cell} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className={cell}>{dateOf(e.date)}</td>
                <td className={cell}>
                  {e.title}
                  {e.category && <span className="text-ink-soft"> · {e.category}</span>}
                </td>
                <td className={cell}>{Object.keys(e.paidBy).map(nameOf).join(' + ')}</td>
                <td className={money}>{formatINR(e.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {group.settlements.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Payments already made</h2>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {group.settlements.map((s) => (
                <tr key={s.id}>
                  <td className={cell}>{dateOf(s.date)}</td>
                  <td className={cell}>
                    {nameOf(s.from)} paid {nameOf(s.to)}
                  </td>
                  <td className={money}>{formatINR(s.paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-ink-soft">
        Made with SplitSmart. Shares are exact to the paisa; leftover paise from rounding go to whoever paid first.
      </p>
    </main>
  )
}
