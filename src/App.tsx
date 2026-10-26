import { ExpenseForm } from './features/expenses/ExpenseForm'
import { Dashboard } from './features/groups/Dashboard'
import { GroupPage } from './features/groups/GroupPage'
import { ImportPage } from './features/groups/ImportPage'
import { HelpPage } from './features/help/HelpPage'
import { ScanPage } from './features/scan/ScanPage'
import { useEffect } from 'react'
import { today } from './features/expenses/draft'
import { useRoute } from './lib/router'
import { useGroups } from './store/groups'

function App() {
  const [section, groupId, sub, expenseId] = useRoute()

  // Monthly Wi-Fi and the like: add any repeats that came due since the last visit
  useEffect(() => useGroups.getState().catchUpRecurring(today()), [])

  if (section === 'help') return <HelpPage />
  if (section === 'import' && groupId) return <ImportPage code={groupId} />
  if (section === 'g' && groupId && sub === 'expense' && expenseId) {
    return <ExpenseForm groupId={groupId} expenseId={expenseId === 'new' ? undefined : expenseId} />
  }
  if (section === 'g' && groupId && sub === 'scan') return <ScanPage groupId={groupId} />
  if (section === 'g' && groupId) return <GroupPage groupId={groupId} />
  return <Dashboard />
}

export default App
