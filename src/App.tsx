import { ExpenseForm } from './features/expenses/ExpenseForm'
import { Dashboard } from './features/groups/Dashboard'
import { GroupPage } from './features/groups/GroupPage'
import { useRoute } from './lib/router'

function App() {
  const [section, groupId, sub, expenseId] = useRoute()

  if (section === 'g' && groupId && sub === 'expense' && expenseId) {
    return <ExpenseForm groupId={groupId} expenseId={expenseId === 'new' ? undefined : expenseId} />
  }
  if (section === 'g' && groupId) return <GroupPage groupId={groupId} />
  return <Dashboard />
}

export default App
