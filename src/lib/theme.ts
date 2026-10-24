import { useState } from 'react'

/*
 * Light / dark / follow the phone. The choice is saved on this device and
 * applied as <html data-theme="…">, which index.css reads. index.html applies
 * it before the first paint so the page never flashes the wrong theme.
 */

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'splitsmart:theme'
const BAR_COLOR = { light: '#f3eee4', dark: '#141311' }

export function savedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
  // The browser bar colour follows the forced theme, or each media query when following the phone
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const own = meta.media.includes('dark') ? BAR_COLOR.dark : BAR_COLOR.light
    meta.content = theme === 'system' ? own : BAR_COLOR[theme]
  })
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Storage can be blocked in private mode; the theme still applies for this visit.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  return [
    theme,
    (next: Theme) => {
      applyTheme(next)
      setTheme(next)
    },
  ] as const
}
