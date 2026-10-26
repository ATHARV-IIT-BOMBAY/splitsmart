import { formatINR, type Paise } from './money'

/** A UPI ID (VPA) looks like name@bank, e.g. riya.s@okhdfcbank or 98xxxxxx10@ybl. */
export function isUpiId(text: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/i.test(text.trim())
}

/**
 * A upi://pay deep link (NPCI's UPI linking spec). Tapping it on a phone opens
 * GPay, PhonePe, Paytm… with the payee, amount and note already filled in.
 */
export function upiLink({ upiId, name, paise, note }: { upiId: string; name: string; paise: Paise; note: string }): string {
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: name,
    am: (paise / 100).toFixed(2),
    cu: 'INR',
    // UPI apps cut long notes; keep it short
    tn: note.slice(0, 50),
  })
  // URLSearchParams writes spaces as "+", which some UPI apps show literally
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`
}

/** WhatsApp-ready text asking someone to pay. */
export function reminderText({
  from,
  to,
  paise,
  groupName,
  link,
}: {
  from: string
  to: string
  paise: Paise
  groupName: string
  link?: string
}): string {
  return [
    `Hey ${from}, you owe ${to} ${formatINR(paise)} for ${groupName} 🧾`,
    link ? `Pay in one tap: ${link}` : '',
    'Sent from SplitSmart',
  ]
    .filter(Boolean)
    .join('\n')
}
