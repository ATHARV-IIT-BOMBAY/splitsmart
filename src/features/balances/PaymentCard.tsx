import { useState, type FormEvent } from 'react'
import { button, card, inputBase } from '../../components/styles'
import { Avatar, Money, Sheet } from '../../components/ui'
import { formatINR } from '../../core/money'
import type { Transfer } from '../../core/settle'
import type { Group } from '../../core/types'
import { isUpiId, reminderText, upiLink } from '../../core/upi'
import { qrDataUrl, shareText } from '../../lib/share'
import { useGroups } from '../../store/groups'

/** One suggested payment: pay by UPI (link or QR), remind on WhatsApp, or mark it paid. */
export function PaymentCard({
  group,
  transfer: t,
  stamping,
  onMarkPaid,
}: {
  group: Group
  transfer: Transfer
  stamping: boolean
  onMarkPaid: () => void
}) {
  const updateMember = useGroups((s) => s.updateMember)
  const from = group.members.find((m) => m.id === t.from)
  const to = group.members.find((m) => m.id === t.to)
  const [addingUpi, setAddingUpi] = useState(false)
  const [upiText, setUpiText] = useState('')
  const [upiError, setUpiError] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  if (!from || !to) return null

  const nameOf = (id: string, lower = false) => (id === group.meId ? (lower ? 'you' : 'You') : (group.members.find((m) => m.id === id)?.name ?? 'Someone'))
  const link = to.upiId ? upiLink({ upiId: to.upiId, name: to.name, paise: t.paise, note: `SplitSmart ${group.name}` }) : undefined

  function saveUpi(event: FormEvent) {
    event.preventDefault()
    if (!isUpiId(upiText)) return setUpiError('That doesn’t look like a UPI ID. It should look like name@bank.')
    updateMember(group.id, to!.id, { upiId: upiText.trim() })
    setAddingUpi(false)
    setUpiError('')
  }

  return (
    <li className={`${card} relative px-4 py-3`}>
      {stamping && (
        <span aria-hidden="true" className="stamp pointer-events-none absolute right-6 top-2">
          PAID
        </span>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1" aria-hidden="true">
          <Avatar member={from} />
          <span className="text-ink-soft">→</span>
          <Avatar member={to} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{nameOf(t.from)}</span>
          <span className="text-ink-soft"> pays </span>
          <span className="font-medium">{nameOf(t.to, true)}</span>
        </span>
        <Money paise={t.paise} className="text-lg font-semibold" />
      </div>

      {addingUpi ? (
        <form onSubmit={saveUpi} className="mt-3 space-y-1">
          <div className="flex gap-2">
            <input
              className={`${inputBase} min-w-0 flex-1 py-2`}
              value={upiText}
              onChange={(e) => {
                setUpiText(e.target.value)
                setUpiError('')
              }}
              placeholder="riya@okaxis"
              aria-label={`${to.name}'s UPI ID`}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button type="submit" className={button.secondary}>
              Save
            </button>
          </div>
          {upiError && <p className="text-xs text-owes">{upiError}</p>}
        </form>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {link ? (
            <>
              <a href={link} className={button.primary}>
                Pay with UPI
              </a>
              <button
                type="button"
                className={button.secondary}
                onClick={async () => setQr(await qrDataUrl(link))}
                aria-label={`Show UPI QR code to pay ${to.name}`}
              >
                QR code
              </button>
            </>
          ) : (
            <button type="button" className={`${button.secondary} col-span-2`} onClick={() => setAddingUpi(true)}>
              Add {to.name}’s UPI ID
            </button>
          )}
          <button
            type="button"
            className={button.secondary}
            onClick={() =>
              shareText(reminderText({ from: from.name, to: to.name, paise: t.paise, groupName: group.name, link }))
            }
          >
            Remind
          </button>
          <button type="button" className={button.secondary} onClick={onMarkPaid} disabled={stamping}>
            Mark paid
          </button>
        </div>
      )}

      <Sheet open={qr !== null} onClose={() => setQr(null)} title={`Pay ${to.name}`}>
        {qr && (
          <div className="space-y-3 text-center">
            <img src={qr} alt={`UPI QR code to pay ${to.name} ${formatINR(t.paise)}`} className="mx-auto w-64 rounded-xl border-2 border-edge bg-white p-2" />
            <p className="money text-2xl font-bold">{formatINR(t.paise)}</p>
            <p className="text-sm text-ink-soft">Scan with any UPI app: GPay, PhonePe, Paytm, BHIM.</p>
            <p className="text-xs text-ink-soft">{to.upiId}</p>
          </div>
        )}
      </Sheet>
    </li>
  )
}
