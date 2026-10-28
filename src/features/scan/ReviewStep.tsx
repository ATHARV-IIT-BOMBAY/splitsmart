import { useState } from 'react'
import { button, card, inputShape } from '../../components/styles'
import { formatINR } from '../../core/money'
import type { Box } from '../../core/parse'
import type { PreparedImage } from '../../lib/image'
import { describeDifference, editItem, emptyCharge, emptyItem, reviewProblems, totals, type ScanDraft } from './draft'

/** Unsure values get the yellow highlighter look; the two colour sets never sit on one field. */
const field = (unsure?: boolean) => `${inputShape} py-1.5 ${unsure ? 'bg-highlight border-accent' : 'bg-paper border-edge'}`

/**
 * Shows just one line of the receipt photo, so you can compare without
 * scrolling. It shrinks to fit narrow screens, so the price column is never cut off.
 */
function LineCrop({ image, bbox }: { image: PreparedImage; bbox: Box }) {
  const pad = 4
  const x0 = Math.max(0, bbox.x0 - pad)
  const y0 = Math.max(0, bbox.y0 - pad)
  const w = Math.min(image.width, bbox.x1 + pad) - x0
  const h = Math.min(image.height, bbox.y1 + pad) - y0
  // Background positions in % are relative to (image − crop), so guard the full-width case
  const at = (offset: number, size: number, total: number) => (total > size ? (offset / (total - size)) * 100 : 0)
  return (
    <div
      aria-hidden="true"
      className="mb-1 w-full overflow-hidden rounded border border-dashed border-line"
      style={{
        maxWidth: (w * 26) / h,
        aspectRatio: `${w} / ${h}`,
        backgroundImage: `url(${image.url})`,
        backgroundSize: `${(image.width / w) * 100}% auto`,
        backgroundPosition: `${at(x0, w, image.width)}% ${at(y0, h, image.height)}%`,
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

  /** Jumps to the next yellow field, so fixing them is tap, type, tap. */
  function nextUnsure() {
    const fields = [...document.querySelectorAll<HTMLInputElement>('input[data-unsure]')]
    const after = fields.find((f) => f.compareDocumentPosition(document.activeElement ?? document.body) & Node.DOCUMENT_POSITION_PRECEDING)
    const target = after ?? fields[0]
    target?.focus()
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

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
            <button
              type="button"
              className="rounded-full border-2 border-accent bg-highlight px-3 py-1 text-xs font-semibold text-ink"
              onClick={nextUnsure}
            >
              {toCheck} {toCheck === 1 ? 'value' : 'values'} to check ↓
            </button>
          )}
        </div>

        <ul className={`${card} divide-y divide-line`}>
          {draft.items.map((item, i) => (
            <li key={item.id} className="px-3 py-2.5" onFocus={() => setActive(item.id)} onMouseEnter={() => setActive(item.id)}>
              {item.bbox && <LineCrop image={image} bbox={item.bbox} />}
              {/* Phones: the name gets its own row so it's readable; qty × price = total below */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  className={`${field(item.doubtfulName)} min-w-0 basis-full sm:basis-auto sm:flex-1`}
                  data-unsure={item.doubtfulName || undefined}
                  value={item.name}
                  onChange={(e) => onChange({ ...draft, items: draft.items.map((r) => (r.id === item.id ? editItem(r, { name: e.target.value }) : r)) })}
                  placeholder="Item name"
                  aria-label={`Item ${i + 1} name`}
                />
                <input
                  className={`${field()} money w-11 text-center text-sm sm:w-12 sm:text-base`}
                  value={item.qty}
                  inputMode="numeric"
                  onChange={(e) => onChange({ ...draft, items: draft.items.map((r) => (r.id === item.id ? editItem(r, { qty: e.target.value }) : r)) })}
                  aria-label={`Item ${i + 1} quantity`}
                />
                <span aria-hidden="true" className="text-ink-soft">
                  ×
                </span>
                <input
                  className={`${field()} money w-[5.5rem] text-right text-sm sm:w-24 sm:text-base`}
                  value={item.unit}
                  inputMode="decimal"
                  onChange={(e) => onChange({ ...draft, items: draft.items.map((r) => (r.id === item.id ? editItem(r, { unit: e.target.value }) : r)) })}
                  placeholder="rate"
                  aria-label={`Item ${i + 1} price each`}
                />
                <span aria-hidden="true" className="hidden text-ink-soft sm:inline">
                  =
                </span>
                <input
                  className={`${field(item.doubtfulAmount)} money min-w-0 flex-1 text-right text-sm sm:w-24 sm:flex-none sm:text-base`}
                  data-unsure={item.doubtfulAmount || undefined}
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
                  className={`${field()} min-w-0 flex-1 text-ink-soft`}
                  value={charge.label}
                  onChange={(e) => onChange({ ...draft, charges: draft.charges.map((c) => (c.id === charge.id ? { ...c, label: e.target.value } : c)) })}
                  aria-label="Charge name"
                />
                <input
                  className={`${field(charge.doubtful)} money w-24 text-right`}
                  data-unsure={charge.doubtful || undefined}
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
            className={`${field()} money w-32 text-right`}
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
