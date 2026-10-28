/** Shared Tailwind class strings, so every screen's controls look the same. */

// Hard offset shadow + press-down effect: the button sinks into its shadow when tapped
const chunky =
  'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-edge px-4 py-2.5 shadow-[3px_3px_0_var(--drop)] transition-[transform,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--drop)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'

export const button = {
  primary: `${chunky} bg-accent font-bold text-accent-ink`,
  secondary: `${chunky} bg-paper font-semibold text-ink`,
  ghost:
    'inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-page hover:text-ink',
  danger: `${chunky} bg-paper font-semibold text-owes`,
}

/** Text field shape without colours, for fields that pick their own (e.g. the yellow "check this" look). */
export const inputShape =
  'rounded-xl border-2 px-3 py-2.5 text-ink placeholder:text-ink-soft/70 transition-shadow focus:shadow-[3px_3px_0_var(--accent)] focus:outline-none'

/** Text field look without a width, for inputs that size themselves. */
export const inputBase = `${inputShape} border-edge bg-paper`

export const input = `w-full ${inputBase}`

export const card = 'rounded-2xl border-2 border-edge bg-paper shadow-[4px_4px_0_var(--drop)]'
