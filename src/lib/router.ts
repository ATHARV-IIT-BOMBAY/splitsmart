import { useSyncExternalStore } from 'react'

/*
 * A tiny hash router: "#/g/abc/expense/new" → ['g', 'abc', 'expense', 'new'].
 * Hash URLs work on GitHub Pages without any server setup.
 */

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function href(...parts: string[]): string {
  return '#/' + parts.map(encodeURIComponent).join('/')
}

export function navigate(...parts: string[]) {
  window.location.hash = href(...parts)
}
