import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { button } from '../../components/styles'
import { FULL, type CropBox } from '../../core/imageops'
import { parseReceipt, type OcrLine } from '../../core/parse'
import { finish, orient, preparePhoto, suggestCrop, suggestStraighten, type PreparedImage, type Rotation } from '../../lib/image'
import { readReceipt, type OcrProgress } from '../../lib/ocr'

type Corner = 'tl' | 'tr' | 'bl' | 'br'
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br']
const CORNER_NAMES: Record<Corner, string> = { tl: 'Top-left', tr: 'Top-right', bl: 'Bottom-left', br: 'Bottom-right' }
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
/** Smallest crop, as a fraction of the photo, so the box can't collapse. */
const MIN_CROP = 0.12

/**
 * Preview with rotate, straighten and crop (pre-set to where the receipt
 * seems to be), then OCR with a scan-line animation and progress.
 */
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
  // Tilted photos are straightened up front, since the reader can't handle a big tilt
  const [straighten, setStraighten] = useState(() => suggestStraighten(photo))
  const [oriented, setOriented] = useState<{ canvas: HTMLCanvasElement; url: string } | null>(null)
  const [crop, setCrop] = useState<CropBox>(() => suggestCrop(orient(photo, 0, straighten)))
  const [autoCropped, setAutoCropped] = useState(crop !== FULL)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState('')
  const [turning, setTurning] = useState(false)
  const frame = useRef<HTMLDivElement>(null)

  // Re-draw the photo whenever it's turned or straightened
  useEffect(() => {
    const canvas = orient(photo, rotation, straighten)
    let url = ''
    let cancelled = false
    canvas.toBlob((blob) => {
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setOriented({ canvas, url })
    }, 'image/jpeg', 0.85)
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [photo, rotation, straighten])

  /** Moves one corner to where `to` says, given the corner's current spot. */
  function moveCorner(corner: Corner, to: (x: number, y: number) => [number, number]) {
    setCrop((c) => {
      const [x, y] = to(corner[1] === 'l' ? c.x0 : c.x1, corner[0] === 't' ? c.y0 : c.y1)
      const fx = Math.min(1, Math.max(0, x))
      const fy = Math.min(1, Math.max(0, y))
      return {
        x0: corner[1] === 'l' ? Math.min(fx, c.x1 - MIN_CROP) : c.x0,
        x1: corner[1] === 'r' ? Math.max(fx, c.x0 + MIN_CROP) : c.x1,
        y0: corner[0] === 't' ? Math.min(fy, c.y1 - MIN_CROP) : c.y0,
        y1: corner[0] === 'b' ? Math.max(fy, c.y0 + MIN_CROP) : c.y1,
      }
    })
    setAutoCropped(false)
  }

  // Arrow keys nudge a focused corner, so the crop works without a mouse
  function nudge(corner: Corner) {
    return (event: KeyboardEvent<HTMLSpanElement>) => {
      const step = event.shiftKey ? 0.1 : 0.02
      const [dx, dy] = ARROWS[event.key] ?? [0, 0]
      if (!dx && !dy) return
      event.preventDefault()
      moveCorner(corner, (x, y) => [x + dx * step, y + dy * step])
    }
  }

  function drag(corner: Corner) {
    return (event: PointerEvent<HTMLSpanElement>) => {
      event.preventDefault()
      const handle = event.currentTarget
      try {
        handle.setPointerCapture(event.pointerId) // keep getting moves when the finger leaves the dot
      } catch {
        // Some browsers refuse capture for synthetic or cancelled pointers; dragging still works
      }
      const move = (e: globalThis.PointerEvent) => {
        const rect = frame.current?.getBoundingClientRect()
        if (!rect) return
        moveCorner(corner, () => [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height])
      }
      const stop = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', stop)
        handle.removeEventListener('pointercancel', stop)
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', stop)
      handle.addEventListener('pointercancel', stop)
    }
  }

  async function read() {
    if (!oriented) return
    setError('')
    setTurning(false)
    setProgress({ stage: 'loading', progress: 0 })
    try {
      const image = await finish(oriented.canvas, crop)
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
          : 'You’re offline and the text reader isn’t saved on your phone yet. Connect to the internet once to download it.',
      )
    }
  }

  // Turning the photo moves the receipt, so suggest a fresh crop
  function rotate(by: 90 | -90) {
    const next = ((rotation + by + 360) % 360) as Rotation
    const box = suggestCrop(orient(photo, next))
    setRotation(next)
    setCrop(box)
    setAutoCropped(box !== FULL)
  }
  const reading = progress !== null
  const percent = Math.round((progress?.progress ?? 0) * 100)
  const pct = (v: number) => `${v * 100}%`

  return (
    <div className="space-y-4">
      <div className="mx-auto w-fit max-w-full overflow-hidden rounded-2xl border-2 border-edge bg-paper">
        {oriented ? (
          <div ref={frame} className="relative touch-none select-none">
            <img src={oriented.url} alt="Receipt photo" draggable={false} className="block max-h-[60vh] w-auto" />
            {/* Crop box: everything outside is dimmed; drag the corners to adjust */}
            <div
              className="absolute border-2 border-accent"
              style={{
                left: pct(crop.x0),
                top: pct(crop.y0),
                width: pct(crop.x1 - crop.x0),
                height: pct(crop.y1 - crop.y0),
                boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)',
              }}
            >
              {reading && progress.stage === 'reading' && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 h-1 bg-accent shadow-[0_0_16px_4px_var(--accent)] transition-[top] duration-300"
                  style={{ top: `${percent}%` }}
                />
              )}
              {!reading &&
                CORNERS.map((corner) => (
                  <span
                    key={corner}
                    role="button"
                    tabIndex={0}
                    aria-label={`${CORNER_NAMES[corner]} corner of the crop. Move it with the arrow keys.`}
                    onPointerDown={drag(corner)}
                    onKeyDown={nudge(corner)}
                    className="absolute size-7 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-edge bg-accent"
                    style={{ left: corner[1] === 'l' ? 0 : '100%', top: corner[0] === 't' ? 0 : '100%' }}
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="grid h-64 w-64 place-items-center text-ink-soft">Preparing photo…</div>
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
          <p className="text-center text-sm text-ink-soft">
            {autoCropped ? 'Cropped to the receipt. Drag the corners to adjust.' : 'Drag the corners to crop to the receipt.'}
          </p>
          <label className="mx-auto flex max-w-sm items-center gap-3 text-sm">
            <span className="shrink-0 font-semibold">Straighten</span>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={straighten}
              onChange={(e) => setStraighten(Number(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="w-10 shrink-0 text-right font-mono">{straighten}°</span>
          </label>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={button.secondary} onClick={() => rotate(-90)} aria-label="Rotate left">
              ↺ Rotate
            </button>
            <button type="button" className={button.secondary} onClick={() => rotate(90)} aria-label="Rotate right">
              Rotate ↻
            </button>
            <button
              type="button"
              className={button.secondary}
              onClick={() => {
                setCrop(FULL)
                setAutoCropped(false)
              }}
            >
              Whole photo
            </button>
            <button type="button" className={button.secondary} onClick={onRetake}>
              Retake
            </button>
          </div>
          <button type="button" className={`${button.primary} w-full`} onClick={read} disabled={!oriented}>
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
