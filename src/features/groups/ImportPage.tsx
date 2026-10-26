import { useEffect, useState } from 'react'
import { button, card, input } from '../../components/styles'
import { AvatarStack, Field, Money } from '../../components/ui'
import { decodeGroup } from '../../core/backup'
import type { Group } from '../../core/types'
import { href, navigate } from '../../lib/router'
import { useGroups } from '../../store/groups'

/** Opened from a shared link or QR code: preview the group, pick who you are, add it. */
export function ImportPage({ code }: { code: string }) {
  const importGroup = useGroups((s) => s.importGroup)
  const existing = useGroups((s) => s.groups)
  const [group, setGroup] = useState<Group | null>(null)
  const [error, setError] = useState('')
  const [meId, setMeId] = useState('')

  useEffect(() => {
    let live = true
    decodeGroup(code)
      .then((g) => live && setGroup(g))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [code])

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-bold">Couldn’t open this group</p>
        <p className="mt-1 text-ink-soft">{error}</p>
        <a href={href()} className={`${button.secondary} mt-6`}>
          Go to my groups
        </a>
      </main>
    )
  }
  if (!group) return <main className="py-16 text-center text-ink-soft">Opening the shared group…</main>

  const already = existing.some((g) => g.id === group.id)
  const spent = group.expenses.reduce((sum, e) => sum + e.amountPaise, 0)
  const add = (replace: boolean) => navigate('g', importGroup(group, { meId: meId || undefined, replace }))

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-16 pt-6">
      <h1 className="text-2xl font-extrabold">Someone shared a group with you</h1>
      <div className={`${card} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold">{group.name}</h2>
          <AvatarStack members={group.members} />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {group.members.length} people · {group.expenses.length} expenses · <Money paise={spent} /> spent
        </p>
      </div>

      <Field label="Which one is you?" hint="So the app can say what you owe.">
        <select className={input} value={meId} onChange={(e) => setMeId(e.target.value)}>
          <option value="">I’m not in this group</option>
          {group.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      {already ? (
        <div className="grid gap-2">
          <p className="text-sm text-ink-soft">You already have this group. The shared one may be newer.</p>
          <button type="button" className={button.primary} onClick={() => add(true)}>
            Update my copy
          </button>
          <button type="button" className={button.secondary} onClick={() => add(false)}>
            Keep both
          </button>
        </div>
      ) : (
        <button type="button" className={`${button.primary} w-full`} onClick={() => add(false)}>
          Add to my groups
        </button>
      )}
      <p className="text-center text-xs text-ink-soft">🔒 The group came inside the link. Nothing was downloaded from a server.</p>
    </main>
  )
}
