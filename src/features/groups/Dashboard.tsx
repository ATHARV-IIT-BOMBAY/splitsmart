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
import { demoGroup } from './demo'
import { NewGroupSheet } from './NewGroupSheet'

export function Dashboard() {
  const groups = useGroups((s) => s.groups)
  const importGroup = useGroups((s) => s.importGroup)
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
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 lg:max-w-6xl">
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
      {groups.length > 0 && (
        <>
          <Overview groups={groups} />
          <div className="mb-5 flex gap-2">
            <button type="button" className={`${button.primary} flex-1 sm:flex-none`} onClick={() => setCreating(true)}>
              + New group
            </button>
            <button type="button" className={button.secondary} onClick={() => backupInput.current?.click()}>
              Import
            </button>
          </div>
        </>
      )}
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
      {importError && (
        <p role="alert" className="mb-4 text-sm text-owes">
          {importError}
        </p>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="Start your first group"
          description="Split hostel bills fairly, item by item, and settle up with the fewest payments."
          actionLabel="Create a group"
          onAction={() => setCreating(true)}
        >
          <button
            type="button"
            className={`${button.secondary} w-full`}
            onClick={() => {
              const demo = demoGroup()
              navigate('g', importGroup(demo, { meId: demo.members[0].id, replace: false }))
            }}
          >
            Try a demo group
          </button>
          <button type="button" className={`${button.ghost} text-xs`} onClick={() => backupInput.current?.click()}>
            Have a backup file? Import it
          </button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

/** Your money across every group, at a glance. */
function Overview({ groups }: { groups: Group[] }) {
  let owed = 0
  let owe = 0
  for (const g of groups) {
    const mine = g.meId ? computeBalances(g)[g.meId] ?? 0 : 0
    if (mine > 0) owed += mine
    else owe -= mine
  }
  return (
    <div className="mb-5 grid grid-cols-2 gap-3">
      <div className={`${card} p-4`}>
        <p className="text-sm text-ink-soft">You’re owed</p>
        <Money paise={owed} className={`text-xl font-bold ${owed > 0 ? 'text-owed' : ''}`} />
      </div>
      <div className={`${card} p-4`}>
        <p className="text-sm text-ink-soft">You owe</p>
        <Money paise={owe} className={`text-xl font-bold ${owe > 0 ? 'text-owes' : ''}`} />
      </div>
    </div>
  )
}

function GroupCard({ group }: { group: Group }) {
  const spent = group.expenses.reduce((sum, e) => sum + e.amountPaise, 0)
  const balances = computeBalances(group)
  const mine = group.meId ? balances[group.meId] ?? 0 : 0
  // Whoever owes the most is (jokingly) buying the next round
  const [debtorId, debt] = Object.entries(balances).sort((a, b) => a[1] - b[1])[0] ?? ['', 0]
  const debtor = debt < 0 ? group.members.find((m) => m.id === debtorId) : undefined

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
      {debtor && (
        <p className="mt-3 border-t border-dashed border-line pt-2 text-xs text-ink-soft">
          🍕 Next treat’s on {debtor.id === group.meId ? 'you' : debtor.name}
        </p>
      )}
    </a>
  )
}
