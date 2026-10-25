import { useEffect, useRef, type ReactNode } from 'react'
import { formatINR, type Paise } from '../core/money'
import type { Member } from '../core/types'
import { button } from './styles'
import { avatarUri } from '../lib/avatars.ts'

export function Avatar({
  member,
  size = 36,
}: {
  member: Pick<Member, 'name' | 'color' | 'emoji' | 'avatar'>
  size?: number
}) {
  const fontSize = member.emoji ? size * 0.7 : size * 0.45

  return (
    <span
      className="inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: member.color }}
    >
      {member.avatar ? (
        <img
          src={avatarUri(member.avatar.style, member.avatar.seed)}
          alt=""
          className="block h-full w-full object-cover"
        />
      ) : (
        <span
          style={{
            fontSize,
            lineHeight: 1,
            width: fontSize,
            height: fontSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: member.emoji ? `translateY(${size * 0.03}px)` : undefined,
          }}
        >
          {member.emoji ?? member.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}
export function AvatarStack({ members, max = 5 }: { members: Member[]; max?: number }) {
  const extra = members.length - max
  return (
    <span className="flex -space-x-2" aria-label={members.map((m) => m.name).join(', ')}>
      {members.slice(0, max).map((m) => (
        <span key={m.id} className="rounded-full">
          <Avatar member={m} size={28} />
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-page text-xs ring-2 ring-paper">
          +{extra}
        </span>
      )}
    </span>
  )
}

export function Money({ paise, className = '' }: { paise: Paise; className?: string }) {
  return <span className={`money ${className}`}>{formatINR(paise)}</span>
}

/**
 * A modal sheet built on the native <dialog>, which gives us focus trapping,
 * Escape to close and screen-reader semantics for free.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal focuses the close button; start on the first field instead
      dialog.querySelector<HTMLElement>('input, select, textarea')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border-2 border-edge bg-paper p-0 text-ink shadow-[6px_6px_0_var(--drop)]"
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button type="button" className={button.ghost} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}
