import { lazy, Suspense, useEffect } from 'react'
import { today } from './features/expenses/draft'
import { Dashboard } from './features/groups/Dashboard'
import { GroupPage } from './features/groups/GroupPage'
import { useRoute } from './lib/router'
import { useGroups } from './store/groups'

// Screens you don't see first load on demand, so the home screen opens faster
const ScanPage = lazy(() => import('./features/scan/ScanPage').then((m) => ({ default: m.ScanPage })))
const ExpenseForm = lazy(() => import('./features/expenses/ExpenseForm').then((m) => ({ default: m.ExpenseForm })))
const ReportPage = lazy(() => import('./features/balances/ReportPage').then((m) => ({ default: m.ReportPage })))
const ImportPage = lazy(() => import('./features/groups/ImportPage').then((m) => ({ default: m.ImportPage })))
const HelpPage = lazy(() => import('./features/help/HelpPage').then((m) => ({ default: m.HelpPage })))

function Screen() {
  const [section, groupId, sub, expenseId] = useRoute()

  if (section === 'help') return <HelpPage />
  if (section === 'import' && groupId) return <ImportPage code={groupId} />
  if (section === 'g' && groupId && sub === 'expense' && expenseId) {
    return <ExpenseForm groupId={groupId} expenseId={expenseId === 'new' ? undefined : expenseId} />
  }
  if (section === 'g' && groupId && sub === 'scan') return <ScanPage groupId={groupId} />
  if (section === 'g' && groupId && sub === 'report') return <ReportPage groupId={groupId} />
  if (section === 'g' && groupId) return <GroupPage groupId={groupId} />
  return <Dashboard />
}

function App() {
  // Monthly Wi-Fi and the like: add any repeats that came due since the last visit
  useEffect(() => useGroups.getState().catchUpRecurring(today()), [])

  return (
    <Suspense fallback={<main className="py-16 text-center text-ink-soft">Loading…</main>}>
      <Screen />
    </Suspense>
  )
}

export default App
