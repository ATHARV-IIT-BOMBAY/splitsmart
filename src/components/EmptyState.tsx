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
        className="pointer-events-none absolute top-8 h-56 w-56 rounded-full bg-indigo-600/30 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-5xl shadow-lg shadow-indigo-900/40"
      >
        💸
      </div>

      <h2 className="relative mt-8 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {title}
      </h2>
      <p className="relative mt-3 max-w-sm text-base leading-relaxed text-gray-400">
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
          className="relative mt-8 cursor-pointer rounded-xl bg-indigo-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 active:translate-y-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}