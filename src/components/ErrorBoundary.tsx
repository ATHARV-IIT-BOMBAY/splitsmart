import { Component, type ReactNode } from 'react'
import { button, card } from './styles'

/**
 * If a screen crashes, show a friendly card instead of a blank page.
 * Groups live in localStorage, so nothing is lost by reloading.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className={`${card} p-6 text-center`}>
          <p className="text-4xl" aria-hidden="true">
            🧾
          </p>
          <h1 className="mt-2 text-xl font-bold">Something went wrong</h1>
          <p className="mt-1 text-ink-soft">Your groups are safe on this phone. Reload to carry on.</p>
          <div className="mt-5 grid gap-2">
            <button type="button" className={button.primary} onClick={() => window.location.reload()}>
              Reload
            </button>
            <a
              href="#/"
              className={button.secondary}
              onClick={() => setTimeout(() => window.location.reload())}
            >
              Go to my groups
            </a>
          </div>
        </div>
      </main>
    )
  }
}
