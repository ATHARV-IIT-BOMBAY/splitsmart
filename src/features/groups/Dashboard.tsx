import { useRef, useState } from 'react'
import { encodeGroup, parseGroup } from '../../core/backup'
import EmptyState from '../../components/EmptyState'
import { ThemeToggle } from '../../components/ThemeToggle'
import { AvatarStack, Money } from '../../components/ui'
import { button, card } from '../../components/styles'
import { computeBalances } from '../../core/balances'
import type { Group } from '../../core/types'
import { href, navigate } from '../../lib/router'
import { useGroups } from '../../store/groups'
import { NewGroupSheet } from './NewGroupSheet'

export function Dashboard() {
  const groups = useGroups((s) => s.groups)
  const [creating, setCreating] = useState(false)
  const [importError, setImportError] = useState('')
  const backupInput = useRef<HTMLInputElement>(null)

  // A backup file goes through the same checks and preview as a shared link
  async function importBackup(file: File) {
    try {
      const group = parseGroup(JSON.parse(await file.text()))
      setImportError('')
      navigate('import', await encodeGroup(group))
    } catch (error) {
      setImportError(error instanceof SyntaxError ? 'That file isn’t a SplitSmart backup.' : (error as Error).message)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">SplitSmart</h1>
          <p className="text-ink-soft">Scan it. Tap it. Settled.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={href('help')} className={button.ghost} aria-label="Help">
            Help
          </a>
          <ThemeToggle />
        </div>
      </header>
      <div className="mb-5 flex gap-2">
        {groups.length > 0 && (
          <button type="button" className={`${button.primary} flex-1 sm:flex-none`} onClick={() => setCreating(true)}>
            + New group
          </button>
        )}
        <button type="button" className={button.secondary} onClick={() => backupInput.current?.click()}>
          Import
        </button>
        <input
          ref={backupInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importBackup(file)
          }}
        />
      </div>
      {importError && (
        <p role="alert" className="mb-4 text-sm text-owes">
          {importError}
        </p>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="Start your first group"
          description="Share expenses with anyone. Make a group, add friends, and start splitting bills."
          actionLabel="Create a group"
          onAction={() => setCreating(true)}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
      )}

      <NewGroupSheet open={creating} onClose={() => setCreating(false)} />
    </main>
  )
}

function GroupCard({ group }: { group: Group }) {
  const spent = group.expenses.reduce((sum, e) => sum + e.amountPaise, 0)
  const mine = group.meId ? computeBalances(group)[group.meId] ?? 0 : 0

  return (
    <a href={href('g', group.id)} className={`${card} block p-4 transition hover:border-accent`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold leading-tight">{group.name}</h2>
        <AvatarStack members={group.members} max={4} />
      </div>
      <dl className="mt-4 flex items-end justify-between gap-3 text-sm">
        <div>
          <dt className="text-ink-soft">Total spent</dt>
          <dd>
            <Money paise={spent} className="text-base font-medium" />
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-ink-soft">{mine > 0 ? 'You’re owed' : mine < 0 ? 'You owe' : 'You’re'}</dt>
          <dd className={mine > 0 ? 'text-owed' : mine < 0 ? 'text-owes' : 'text-ink-soft'}>
            {mine === 0 ? 'all square' : <Money paise={Math.abs(mine)} className="text-base font-semibold" />}
          </dd>
        </div>
      </dl>
    </a>
  )
}
