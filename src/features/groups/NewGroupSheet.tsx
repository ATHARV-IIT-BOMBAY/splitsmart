import { useState, type FormEvent } from 'react'
import { parseNames } from '../../core/members'
import { Field, Sheet } from '../../components/ui'
import { button, input } from '../../components/styles'
import { navigate } from '../../lib/router'
import { useGroups } from '../../store/groups'

const MY_NAME_KEY = 'splitsmart:my-name'

function savedName(): string {
  try {
    return localStorage.getItem(MY_NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

/** One sheet creates the group, adds you, and adds all your friends at once. */
export function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createGroup = useGroups((s) => s.createGroup)
  const [name, setName] = useState('')
  const [myName, setMyName] = useState(savedName)
  const [friends, setFriends] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const friendNames = parseNames(friends)
    if (!name.trim()) return setError('Give the group a name.')
    if (!myName.trim()) return setError('Enter your name.')
    if (friendNames.length === 0) return setError('Add at least one friend.')

    try {
      localStorage.setItem(MY_NAME_KEY, myName.trim())
    } catch {
      // Private mode can block storage; the group is still created.
    }
    const id = createGroup(name.trim(), myName.trim(), friendNames)
    setName('')
    setFriends('')
    setError('')
    onClose()
    navigate('g', id)
  }

  return (
    <Sheet open={open} onClose={onClose} title="New group">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Group name">
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Night Canteen Gang"
            autoFocus
          />
        </Field>
        <Field label="Your name">
          <input
            className={input}
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Riya"
            autoComplete="given-name"
          />
        </Field>
        <Field label="Friends" hint="Separate names with commas.">
          <input
            className={input}
            value={friends}
            onChange={(e) => setFriends(e.target.value)}
            placeholder="Arjun, Meera, Kabir"
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-owes">
            {error}
          </p>
        )}
        <button type="submit" className={`${button.primary} w-full`}>
          Create group
        </button>
      </form>
    </Sheet>
  )
}
