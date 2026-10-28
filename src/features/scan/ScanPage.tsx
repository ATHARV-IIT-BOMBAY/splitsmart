import { useState } from 'react'
import { button } from '../../components/styles'
import { parseReceipt, shopName, type OcrLine } from '../../core/parse'
import type { PreparedImage } from '../../lib/image'
import { href, navigate } from '../../lib/router'
import { useGroup, useGroups } from '../../store/groups'
import { AssignStep } from './AssignStep'
import { CaptureStep } from './CaptureStep'
import { draftFromParsed, emptyItem, type ScanDraft } from './draft'
import { ReadStep } from './ReadStep'
import { ReviewStep } from './ReviewStep'

type Step =
  | { name: 'capture' }
  | { name: 'read'; photo: ImageBitmap }
  | { name: 'nothing-found'; image: PreparedImage; photo: ImageBitmap }
  | { name: 'review'; image: PreparedImage }
  | { name: 'assign'; image: PreparedImage; usePrinted: boolean }

const STEPS = ['Scan', 'Check', 'Assign'] as const

/** Scan → check → assign, all on one page so nothing is lost between steps. */
export function ScanPage({ groupId }: { groupId: string }) {
  const group = useGroup(groupId)
  const saveExpense = useGroups((s) => s.saveExpense)
  const [step, setStep] = useState<Step>({ name: 'capture' })
  const [draft, setDraft] = useState<ScanDraft>({ items: [], charges: [], printedTotal: '' })
  // Batch scan: the photos still to do, and where we are ("Receipt 2 of 3")
  const [queue, setQueue] = useState<ImageBitmap[]>([])
  const [batch, setBatch] = useState<{ index: number; total: number; saved: number } | null>(null)

  if (!group) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">This group doesn’t exist on this device.</p>
        <a href={href()} className={`${button.secondary} mt-4`}>
          Back to groups
        </a>
      </main>
    )
  }

  function onRead(photo: ImageBitmap, image: PreparedImage, lines: OcrLine[]) {
    const parsed = parseReceipt(lines)
    setDraft({ ...draftFromParsed(parsed), shop: shopName(lines) })
    setStep(parsed.items.length > 0 ? { name: 'review', image } : { name: 'nothing-found', image, photo })
  }

  function start(photos: ImageBitmap[]) {
    setQueue(photos.slice(1))
    setBatch(photos.length > 1 ? { index: 1, total: photos.length, saved: 0 } : null)
    setStep({ name: 'read', photo: photos[0] })
  }

  /** Moves on to the next photo in a batch; back to the group when there's none left. */
  function next(saved: boolean) {
    const [photo, ...rest] = queue
    if (!photo) return navigate('g', group!.id)
    setQueue(rest)
    setBatch((b) => b && { ...b, index: b.index + 1, saved: b.saved + (saved ? 1 : 0) })
    setDraft({ items: [], charges: [], printedTotal: '' })
    setStep({ name: 'read', photo })
  }

  const current = step.name === 'assign' ? 2 : step.name === 'review' ? 1 : 0

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-4">
      <a href={href('g', group.id)} className={button.ghost}>
        ← {group.name}
      </a>
      <h1 className="sr-only">Scan a receipt</h1>
      <ol className="my-4 flex items-center gap-2 text-sm" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === current ? 'step' : undefined} className="flex items-center gap-2">
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                i <= current ? 'bg-ink text-paper' : 'border border-line text-ink-soft'
              }`}
            >
              {i + 1}
            </span>
            <span className={i === current ? 'font-semibold' : 'text-ink-soft'}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {batch && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 border-edge bg-pop px-3 py-2 text-sm font-semibold text-[#1c1b19]">
          <span>
            Receipt {batch.index} of {batch.total}
            {batch.saved > 0 && <span className="font-normal"> · {batch.saved} saved</span>}
          </span>
          <button type="button" className="underline" onClick={() => next(false)}>
            {queue.length ? 'Skip this one' : 'Skip and finish'}
          </button>
        </div>
      )}

      {/* A new key per receipt gives each one in a batch a fresh crop, check and assign screen */}
      <div key={batch?.index ?? 0}>
        {step.name === 'capture' && <CaptureStep onPhotos={start} />}

        {step.name === 'read' && (
          <ReadStep
            photo={step.photo}
            onDone={(image, lines) => onRead(step.photo, image, lines)}
            onRetake={() => setStep({ name: 'capture' })}
          />
        )}

        {step.name === 'nothing-found' && (
          <div className="mx-auto max-w-md space-y-4 text-center">
            <img src={step.image.url} alt="Your photo" className="mx-auto max-h-64 rounded-xl" />
            <p className="text-lg font-bold">Couldn’t read this photo</p>
            <p className="text-sm text-ink-soft">
              The photo might be blurry or sideways (we tried turning it). Try taking it again in good light, or type the items in yourself.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={button.primary} onClick={() => setStep({ name: 'capture' })}>
                Retake
              </button>
              <button type="button" className={button.secondary} onClick={() => setStep({ name: 'read', photo: step.photo })}>
                Rotate and try again
              </button>
              <button
                type="button"
                className={button.secondary}
                onClick={() => {
                  setDraft({ items: [emptyItem()], charges: [], printedTotal: '' })
                  setStep({ name: 'review', image: step.image })
                }}
              >
                Type items
              </button>
              <a href={href('g', group.id, 'expense', 'new')} className={button.secondary}>
                Simple expense
              </a>
            </div>
          </div>
        )}

        {step.name === 'review' && (
          <ReviewStep
            image={step.image}
            draft={draft}
            onChange={setDraft}
            onNext={(usePrinted) => setStep({ name: 'assign', image: step.image, usePrinted })}
          />
        )}

        {step.name === 'assign' && (
          <>
            <button type="button" className={`${button.ghost} mb-2`} onClick={() => setStep({ name: 'review', image: step.image })}>
              ← Back to items
            </button>
            <AssignStep
              group={group}
              draft={draft}
              usePrinted={step.usePrinted}
              onChange={setDraft}
              onSave={(expense) => {
                saveExpense(group.id, expense)
                next(true)
              }}
            />
          </>
        )}
      </div>
    </main>
  )
}
