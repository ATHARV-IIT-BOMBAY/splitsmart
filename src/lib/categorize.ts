import { itemKey, pickCategory, receiptCategories } from '../core/categories'
import type { Category } from '../core/types'
import type { ClassifyMessage, ClassifyRequest } from '../workers/classify.worker'

/*
 * Categorises item names with the on-device model. Names the user has
 * re-categorised before are answered from their saved choice, and every answer
 * is remembered for this visit, so the model only sees new names.
 */

const OVERRIDES_KEY = 'splitsmart:categories'

export type ModelProgress = { loaded: number; total: number }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: Category[]) => void; reject: (e: Error) => void }>()
const progressListeners = new Set<(p: ModelProgress) => void>()
const known = new Map<string, Category>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/classify.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<ClassifyMessage>) => {
    if (data.type === 'progress') return progressListeners.forEach((listen) => listen(data))
    const job = pending.get(data.id)
    pending.delete(data.id)
    if (data.type === 'result') job?.resolve(data.results.map((r) => pickCategory(r.labels, r.scores)))
    else job?.reject(new Error(data.message))
  }
  return worker
}

function overrides(): Record<string, Category> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** Remember the user's choice so the same item gets it next time. */
export function rememberCategory(name: string, category: Category) {
  const key = itemKey(name)
  known.set(key, category)
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ ...overrides(), [key]: category }))
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit
  }
}

export async function categorize(names: string[], onProgress?: (p: ModelProgress) => void): Promise<Category[]> {
  const saved = overrides()
  const keys = names.map(itemKey)
  const unknown = [...new Set(keys.filter((k) => k && !saved[k] && !known.has(k)))]

  if (unknown.length > 0) {
    if (onProgress) progressListeners.add(onProgress)
    try {
      const id = nextId++
      const results = await new Promise<Category[]>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        getWorker().postMessage({ id, texts: unknown } satisfies ClassifyRequest)
      })
      unknown.forEach((key, i) => known.set(key, results[i]))
    } finally {
      if (onProgress) progressListeners.delete(onProgress)
    }
  }
  return keys.map((k) => saved[k] ?? known.get(k) ?? 'Other')
}

/** Categories for a receipt's items, using the whole list as context (see receiptCategories). */
export async function categorizeReceipt(names: string[], onProgress?: (p: ModelProgress) => void): Promise<Category[]> {
  const saved = overrides()
  const perItem = await categorize(names, onProgress)
  const listText = names.join(', ')
  const [whole] = names.length > 1 ? await categorize([listText], onProgress) : perItem
  const combined = receiptCategories(perItem, whole)
  // The user's own corrections always win over the receipt-wide guess
  return names.map((name, i) => saved[itemKey(name)] ?? combined[i])
}
