/// <reference lib="webworker" />
import { pipeline, type ZeroShotClassificationPipeline } from '@huggingface/transformers'
import { HYPOTHESIS, MODEL_LABELS } from '../core/categories'

/*
 * Runs the MobileBERT zero-shot model off the main thread, so scrolling and
 * tapping never freeze while it works. The ~27 MB model downloads on first use
 * and the browser caches it, so later scans (and offline use) are instant.
 */

export type ClassifyRequest = { id: number; texts: string[] }
export type ClassifyMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; id: number; results: { labels: string[]; scores: number[] }[] }
  | { type: 'error'; id: number; message: string }

let classifier: Promise<ZeroShotClassificationPipeline> | null = null
const bytes = new Map<string, { loaded: number; total: number }>()

function load() {
  classifier ??= pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
    dtype: 'q8',
    progress_callback: (info) => {
      // One update per file being downloaded; report the sum across files
      if (info.status !== 'progress') return
      bytes.set(info.file, { loaded: info.loaded, total: info.total })
      const all = [...bytes.values()]
      postMessage({
        type: 'progress',
        loaded: all.reduce((s, b) => s + b.loaded, 0),
        total: all.reduce((s, b) => s + b.total, 0),
      } satisfies ClassifyMessage)
    },
  }) as Promise<ZeroShotClassificationPipeline>
  classifier.catch(() => (classifier = null))
  return classifier
}

self.onmessage = async ({ data }: MessageEvent<ClassifyRequest>) => {
  try {
    const run = await load()
    const results = []
    for (const text of data.texts) {
      // Independent per-label scores measured best on hostel items (15/22 vs 12/22)
      const out = await run(text, Object.keys(MODEL_LABELS), { hypothesis_template: HYPOTHESIS, multi_label: true })
      results.push({ labels: out.labels, scores: out.scores })
    }
    postMessage({ type: 'result', id: data.id, results } satisfies ClassifyMessage)
  } catch (error) {
    postMessage({ type: 'error', id: data.id, message: String(error) } satisfies ClassifyMessage)
  }
}
