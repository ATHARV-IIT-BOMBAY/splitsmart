import type { Worker } from 'tesseract.js'
import type { OcrLine } from '../core/parse'

/*
 * Runs Tesseract.js in its own Web Worker, so the page never freezes.
 * The library and its English model load only when the first receipt is
 * scanned, never on the first screen.
 */

export type OcrProgress = { stage: 'loading' | 'reading'; progress: number }

let worker: Promise<Worker> | null = null
let report: (p: OcrProgress) => void = () => {}

function getWorker(): Promise<Worker> {
  worker ??= import('tesseract.js').then(async ({ createWorker, PSM }) => {
    // Engine files are served by our own site (see scripts/copy-ocr-assets.mjs) so
    // they can be cached for offline use. Absolute URLs, because the worker runs from a blob.
    const ours = (path: string) => new URL(path, document.baseURI).href
    const w = await createWorker('eng', 1, {
      workerPath: ours('tesseract/worker.min.js'),
      corePath: ours('tesseract/'),
      logger: (m) => report({ stage: m.status === 'recognizing text' ? 'reading' : 'loading', progress: m.progress }),
    })
    // Receipts are one column of lines with varied sizes; keep spacing between words
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: '1' })
    return w
  })
  // If loading fails (e.g. offline before the model is cached), let the next try start fresh
  worker.catch(() => (worker = null))
  return worker
}

type Page = Awaited<ReturnType<Worker['recognize']>>['data']

const toLines = (page: Page): OcrLine[] =>
  (page.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text.trim(),
        bbox: line.bbox,
        words: line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })),
      })),
    ),
  )

export async function readReceipt(image: HTMLCanvasElement, onProgress: (p: OcrProgress) => void): Promise<OcrLine[]> {
  report = onProgress
  const w = await getWorker()
  const lines = toLines((await w.recognize(image, {}, { blocks: true })).data)

  // Folds and shadows can make Tesseract stop part-way down a receipt. If the
  // bottom of the photo wasn't read, read just that part again as one block.
  const lastBottom = Math.max(0, ...lines.map((l) => l.bbox.y1))
  if (lines.length > 0 && lastBottom < image.height * 0.85) {
    const { PSM } = await import('tesseract.js')
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    try {
      const rectangle = { left: 0, top: lastBottom, width: image.width, height: image.height - lastBottom }
      const rest = toLines((await w.recognize(image, { rectangle }, { blocks: true })).data)
      lines.push(...rest.filter((l) => l.bbox.y0 >= lastBottom - 4 && l.text))
    } finally {
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
    }
  }
  return lines
}
