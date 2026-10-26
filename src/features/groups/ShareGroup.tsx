import { useState } from 'react'
import { button } from '../../components/styles'
import { encodeGroup, toBackup } from '../../core/backup'
import type { Group } from '../../core/types'
import { href } from '../../lib/router'
import { qrDataUrl, shareText } from '../../lib/share'

/** QR codes hold about 2,900 characters at low error correction; longer links are sent as text. */
const QR_LIMIT = 2900

async function linkTo(group: Group) {
  return new URL(href('import', await encodeGroup(group)), window.location.href).href
}

/** Send the group to a friend's phone with no server: a link, a QR code or a backup file. */
export function ShareGroup({ group }: { group: Group }) {
  const [qr, setQr] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function showQr() {
    const link = await linkTo(group)
    if (link.length > QR_LIMIT) return setNote('This group is too big for a QR code. Send the link instead.')
    setNote('')
    setQr(await qrDataUrl(link, 'L'))
  }

  function download() {
    const url = URL.createObjectURL(new Blob([toBackup(group)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${group.name.replace(/[^\w-]+/g, '-')}.splitsmart.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-2 border-t border-line pt-4" aria-labelledby="share-heading">
      <h3 id="share-heading" className="font-bold">
        Share this group
      </h3>
      <p className="text-sm text-ink-soft">Your friends get the whole group on their phone. Nothing goes through a server.</p>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={button.secondary}
          onClick={async () => shareText(`🧾 ${group.name} on SplitSmart: open to see who owes what\n${await linkTo(group)}`)}
        >
          Send link
        </button>
        <button type="button" className={button.secondary} onClick={showQr}>
          QR code
        </button>
        <button type="button" className={button.secondary} onClick={download}>
          Backup
        </button>
      </div>
      {note && <p className="text-sm text-owes">{note}</p>}
      {qr && (
        <div className="text-center">
          <img src={qr} alt={`QR code to open ${group.name} on another phone`} className="mx-auto w-60 rounded-xl border-2 border-edge bg-white p-2" />
          <p className="mt-1 text-xs text-ink-soft">Scan with a friend’s phone camera to copy this group to it.</p>
        </div>
      )}
    </section>
  )
}
