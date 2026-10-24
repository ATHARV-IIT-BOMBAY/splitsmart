import { useTheme, type Theme } from '../lib/theme'

const OPTIONS: { theme: Theme; icon: string; label: string }[] = [
  { theme: 'light', icon: '☀', label: 'Light theme' },
  { theme: 'system', icon: '◐', label: 'Match device theme' },
  { theme: 'dark', icon: '☾', label: 'Dark theme' },
]

/** Three-way switch: light, match the phone, dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl border-2 border-edge bg-paper p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.theme}
          type="button"
          role="radio"
          aria-checked={theme === o.theme}
          aria-label={o.label}
          title={o.label}
          onClick={() => setTheme(o.theme)}
          className={`grid size-8 place-items-center rounded-lg text-base transition ${
            theme === o.theme ? 'bg-pop text-[#1c1b19] ring-2 ring-edge' : 'text-ink-soft hover:text-ink'
          }`}
        >
          <span aria-hidden="true">{o.icon}</span>
        </button>
      ))}
    </div>
  )
}
