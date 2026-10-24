import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-8 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-line bg-paper text-5xl"
      >
        💸
      </div>

      <h2 className="relative mt-8 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <p className="relative mt-3 max-w-sm text-base leading-relaxed text-ink-soft">
        {description}
      </p>

      {children && (
        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="relative mt-8 cursor-pointer rounded-xl bg-accent px-7 py-3 text-base font-semibold text-accent-ink transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
