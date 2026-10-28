import type { ReactNode } from 'react'
import { button } from './styles'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}

/** How SplitSmart works, in three receipt-style steps. */
const STEPS = [
  { icon: '📸', title: 'Scan', text: 'Snap the bill. It’s read on your phone.' },
  { icon: '👆', title: 'Tap', text: 'Tap who had what. GST splits fairly.' },
  { icon: '✅', title: 'Settle', text: 'Fewest payments, with UPI in one tap.' },
]

export default function EmptyState({ title, description, actionLabel, onAction, children }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center px-2 py-10 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute top-6 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div
        aria-hidden="true"
        className="relative flex h-24 w-24 rotate-[-4deg] items-center justify-center rounded-3xl border-2 border-edge bg-paper text-5xl shadow-[4px_4px_0_var(--drop)]"
      >
        🧾
      </div>

      <h2 className="relative mt-8 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      <p className="relative mt-3 max-w-sm text-base leading-relaxed text-ink-soft">{description}</p>

      <ol className="relative mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-center gap-3 rounded-2xl border-2 border-edge bg-paper p-3 text-left sm:flex-col sm:text-center">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-pop text-lg ring-2 ring-edge">
              {step.icon}
            </span>
            <span>
              <span className="block font-bold">
                {i + 1}. {step.title}
              </span>
              <span className="block text-sm text-ink-soft">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className={`${button.primary} relative mt-8 w-full max-w-xs`}>
          {actionLabel}
        </button>
      )}

      {children && <div className="relative mt-3 flex w-full max-w-xs flex-col items-center gap-2">{children}</div>}
    </div>
  )
}
