import { useEffect, useState } from 'react'
import { button } from '../../components/styles'
import { parseReceipt, type OcrLine } from '../../core/parse'
import { preparePhoto, type PreparedImage, type Rotation } from '../../lib/image'
import { readReceipt, type OcrProgress } from '../../lib/ocr'

/** Preview with rotate buttons, then OCR with a scan-line animation and progress. */
export function ReadStep({
  photo,
  onDone,
  onRetake,
}: {
  photo: ImageBitmap
  onDone: (image: PreparedImage, lines: OcrLine[]) => void
  onRetake: () => void
}) {
  const [rotation, setRotation] = useState<Rotation>(0)
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState('')
  const [turning, setTurning] = useState(false)

  useEffect(() => {
    let cancelled = false
    void preparePhoto(photo, rotation).then((prepared) => !cancelled && setImage(prepared))
    return () => {
      cancelled = true
    }
  }, [photo, rotation])

  async function read() {
    if (!image) return
    setError('')
    setTurning(false)
    setProgress({ stage: 'loading', progress: 0 })
    try {
      const lines = await readReceipt(image.ocrCanvas, setProgress)
      if (parseReceipt(lines).items.length > 0) return onDone(image, lines)
      // Nothing found: the photo may be upside down or sideways, so try the other ways round
      setTurning(true)
      for (const turn of [180, 90, 270] as const) {
        const turned = ((rotation + turn) % 360) as Rotation
        const prepared = await preparePhoto(photo, turned)
        const turnedLines = await readReceipt(prepared.ocrCanvas, setProgress)
        if (parseReceipt(turnedLines).items.length > 0) {
          setRotation(turned)
          return onDone(prepared, turnedLines)
        }
      }
      onDone(image, lines)
    } catch {
      setProgress(null)
      setError(
        navigator.onLine
          ? 'Reading failed. Try again, or retake the photo.'
          : 'You’re offline and the text reader isn’t saved on this device yet. Connect once, then it works offline.',
      )
    }
  }

  const rotate = (by: 90 | -90) => setRotation((r) => (((r + by + 360) % 360) as Rotation))
  const reading = progress !== null
  const percent = Math.round((progress?.progress ?? 0) * 100)

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border border-line bg-paper">
        {image ? (
          <img src={image.url} alt="Receipt photo" className="max-h-[60vh] w-auto" />
        ) : (
          <div className="grid h-64 w-64 place-items-center text-ink-soft">Preparing photo…</div>
        )}
        {reading && progress.stage === 'reading' && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 h-1 bg-accent shadow-[0_0_16px_4px_var(--accent)] transition-[top] duration-300"
            style={{ top: `${percent}%` }}
          />
        )}
      </div>

      {reading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress.stage === 'reading' ? percent : 5}%` }}
            />
          </div>
          <p className="text-center text-sm text-ink-soft">
            {progress.stage === 'loading'
              ? 'Getting the text reader ready (only slow the first time)…'
              : turning
                ? `No items yet. Trying the photo turned around · ${percent}%`
                : `Reading text · ${percent}%`}
          </p>
          <p className="text-center text-xs text-ink-soft">🔒 Processed on this device. Nothing is uploaded.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-2">
            <button type="button" className={button.secondary} onClick={() => rotate(-90)} aria-label="Rotate left">
              ↺ Rotate
            </button>
            <button type="button" className={button.secondary} onClick={() => rotate(90)} aria-label="Rotate right">
              Rotate ↻
            </button>
            <button type="button" className={button.secondary} onClick={onRetake}>
              Retake
            </button>
          </div>
          <p className="text-center text-sm text-ink-soft">Turn the photo so the text reads left to right.</p>
          <button type="button" className={`${button.primary} w-full`} onClick={read} disabled={!image}>
            Read receipt
          </button>
          {error && (
            <p role="alert" className="text-center text-sm text-owes">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
