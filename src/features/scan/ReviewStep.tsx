import { useState } from 'react'
import { button, card, inputBase } from '../../components/styles'
import { formatINR } from '../../core/money'
import type { Box } from '../../core/parse'
import type { PreparedImage } from '../../lib/image'
import { describeDifference, editItem, emptyCharge, emptyItem, reviewProblems, totals, type ScanDraft } from './draft'

const field = `${inputBase} py-1.5`
const doubtful = 'bg-highlight border-accent'

/** Shows just one line of the receipt photo, so you can compare without scrolling. */
function LineCrop({ image, bbox }: { image: PreparedImage; bbox: Box }) {
  const pad = 4
  const height = 26
  const scale = height / (bbox.y1 - bbox.y0 + pad * 2)
  return (
    <div
      aria-hidden="true"
      className="mb-1 max-w-full overflow-hidden rounded border border-dashed border-line"
      style={{
        height,
        width: (bbox.x1 - bbox.x0 + pad * 2) * scale,
        backgroundImage: `url(${image.url})`,
        backgroundSize: `${image.width * scale}px ${image.height * scale}px`,
        backgroundPosition: `${-(bbox.x0 - pad) * scale}px ${-(bbox.y0 - pad) * scale}px`,
      }}
    />
  )
}

export function ReviewStep({
  image,
  draft,
  onChange,
  onNext,
}: {
  image: PreparedImage
  draft: ScanDraft
  onChange: (draft: ScanDraft) => void
  onNext: (usePrinted: boolean) => void
}) {
  const [active, setActive] = useState<string | null>(null)
  const [showProblems, setShowProblems] = useState(false)
  const { calculated, printed, difference } = totals(draft)
  const problems = reviewProblems(draft)
  const toCheck =
    draft.items.filter((i) => i.doubtfulName || i.doubtfulAmount).length + draft.charges.filter((c) => c.doubtful).length
  const activeBox = [...draft.items, ...draft.charges].find((r) => r.id === active)?.bbox

  function next(usePrinted: boolean) {
    if (problems.length > 0) return setShowProblems(true)
    onNext(usePrinted)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {/* Photo beside the table on desktop; tucked away on phones (each line has its own crop) */}
      <details className="group lg:hidden">
        <summary className={`${button.secondary} w-full cursor-pointer`}>Show receipt photo</summary>
        <img src={image.url} alt="Receipt photo" className="mt-3 w-full rounded-xl" />
      </details>
      <div className="relative hidden self-start lg:sticky lg:top-4 lg:block">
        <img src={image.url} alt="Receipt photo" className="w-full rounded-xl border border-line" />
        {activeBox && (
          <div
            aria-hidden="true"
            className="absolute rounded border-2 border-accent bg-accent/15"
            style={{
              left: `${(activeBox.x0 / image.width) * 100}%`,
              top: `${(activeBox.y0 / image.height) * 100}%`,
              width: `${((activeBox.x1 - activeBox.x0) / image.width) * 100}%`,
              height: `${((activeBox.y1 - activeBox.y0) / image.height) * 100}%`,
            }}
          />
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Check the items</h2>
          {toCheck > 0 && (
            <span className="rounded-full bg-highlight px-3 py-1 text-xs font-semibold">
              {toCheck} {toCheck === 1 ? 'value' : 'values'} to check
            </span>
          )}
        </div>

        <ul className={`${card} divide-y divide-line`}>
          {draft.items.map((item, i) => (
            <li key={item.id} className="px-3 py-2.5" onFocus={() => setActive(item.id)} onMouseEnter={() => setActive(item.id)}>
              {item.bbox && <LineCrop image={image} bbox={item.bbox} />}
              <div className="flex items-center gap-2">
                <input
                  className={`${field} min-w-0 flex-1 ${item.doubtfulName ? doubtful : ''}`}
                  value={item.name}
                  onChange={(e) => onChange({ ...draft, items: draft.items.map((r) => (r.id === item.id ? editItem(r, { name: e.target.value }) : r)) })}
                  placeholder="Item name"
                  aria-label={`Item ${i + 1} name`}
                />
                <input
                  className={`${field} money w-12 text-center`}
                  value={item.qty}
                  inputMode="numeric"
                  onChange={(e) => onChange({ ...draft, items: draft.items.map((r) => (r.id === item.id ? editItem(r, { qty: e.target.value }) : r)) })}
                  aria-label={`Item ${i + 1} quantity`}
                />
                <input
                  className={`${field} money w-24 text-right ${item.doubtfulAmount ? doubtful : ''}`}
                  value={item.total}
                  inputMode="decimal"
                  onChange={(e) => onChange({ ...draft, items: draft.items.map((r) => (r.id === item.id ? editItem(r, { total: e.target.value }) : r)) })}
                  placeholder="0.00"
                  aria-label={`Item ${i + 1} price`}
                />
                <button
                  type="button"
                  className={button.ghost}
                  aria-label={`Delete ${item.name || `item ${i + 1}`}`}
                  onClick={() => onChange({ ...draft, items: draft.items.filter((r) => r.id !== item.id) })}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {draft.charges.map((charge) => (
            <li key={charge.id} className="bg-page/50 px-3 py-2.5" onFocus={() => setActive(charge.id)} onMouseEnter={() => setActive(charge.id)}>
              {charge.bbox && <LineCrop image={image} bbox={charge.bbox} />}
              <div className="flex items-center gap-2">
                <input
                  className={`${field} min-w-0 flex-1 text-ink-soft`}
                  value={charge.label}
                  onChange={(e) => onChange({ ...draft, charges: draft.charges.map((c) => (c.id === charge.id ? { ...c, label: e.target.value } : c)) })}
                  aria-label="Charge name"
                />
                <input
                  className={`${field} money w-24 text-right ${charge.doubtful ? doubtful : ''}`}
                  value={charge.amount}
                  inputMode="decimal"
                  onChange={(e) =>
                    onChange({ ...draft, charges: draft.charges.map((c) => (c.id === charge.id ? { ...c, amount: e.target.value, doubtful: false } : c)) })
                  }
                  aria-label={`${charge.label} amount`}
                />
                <button
                  type="button"
                  className={button.ghost}
                  aria-label={`Delete ${charge.label}`}
                  onClick={() => onChange({ ...draft, charges: draft.charges.filter((c) => c.id !== charge.id) })}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button type="button" className={button.secondary} onClick={() => onChange({ ...draft, items: [...draft.items, emptyItem()] })}>
            + Item
          </button>
          <button type="button" className={button.secondary} onClick={() => onChange({ ...draft, charges: [...draft.charges, emptyCharge()] })}>
            + Tax or charge
          </button>
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Total on receipt</span>
          <input
            className={`${field} money w-32 text-right`}
            value={draft.printedTotal}
            inputMode="decimal"
            placeholder="not found"
            onChange={(e) => onChange({ ...draft, printedTotal: e.target.value })}
          />
        </label>

        <div role="status" aria-live="polite">
          {printed === null || printed === undefined ? (
            <p className="rounded-xl bg-highlight p-3 text-sm">
              No total found on the receipt. Items and charges add up to <strong className="money">{formatINR(calculated)}</strong>. Check that’s
              what you paid.
            </p>
          ) : difference === 0 ? (
            <p className="rounded-xl bg-owed/15 p-3 text-sm text-owed">
              ✓ Items and charges add up to <strong className="money">{formatINR(calculated)}</strong>, matching the receipt.
            </p>
          ) : (
            <p className="rounded-xl bg-highlight p-3 text-sm">
              Items and charges are <strong>{describeDifference(difference)}</strong> the printed{' '}
              <span className="money">{formatINR(printed)}</span>. Check the highlighted prices.
            </p>
          )}
        </div>

        {showProblems && problems.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-xl border border-owes/40 bg-owes/10 p-3 text-sm text-owes">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        {printed !== null && printed !== undefined && difference !== 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className={button.primary} onClick={() => next(true)}>
              Use receipt total <span className="money">{formatINR(printed)}</span>
            </button>
            <button type="button" className={button.secondary} onClick={() => next(false)}>
              Use items total <span className="money">{formatINR(calculated)}</span>
            </button>
          </div>
        ) : (
          <button type="button" className={`${button.primary} w-full`} onClick={() => next(false)}>
            Next: who had what
          </button>
        )}
      </div>
    </div>
  )
}
