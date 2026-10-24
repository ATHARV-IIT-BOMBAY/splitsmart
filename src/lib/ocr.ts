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
    const w = await createWorker('eng', 1, {
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

export async function readReceipt(image: HTMLCanvasElement, onProgress: (p: OcrProgress) => void): Promise<OcrLine[]> {
  report = onProgress
  const w = await getWorker()
  const { data } = await w.recognize(image, {}, { blocks: true })
  return (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text.trim(),
        bbox: line.bbox,
        words: line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })),
      })),
    ),
  )
}
