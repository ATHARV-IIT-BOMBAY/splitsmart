/** Shared Tailwind class strings, so every screen's controls look the same. */
export const button = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink transition active:scale-[0.98] hover:brightness-105',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 font-medium text-ink transition active:scale-[0.98] hover:bg-page',
  ghost:
    'inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-page hover:text-ink',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-owes/40 px-4 py-2.5 font-medium text-owes transition active:scale-[0.98] hover:bg-owes/10',
}

/** Text field look without a width, for inputs that size themselves. */
export const inputBase =
  'rounded-xl border border-line bg-paper px-3 py-2.5 text-ink placeholder:text-ink-soft/70 focus:border-accent focus:outline-none'

export const input = `w-full ${inputBase}`

export const card = 'rounded-2xl border border-line bg-paper'
