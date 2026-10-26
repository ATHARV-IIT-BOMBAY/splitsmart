import { describe, expect, it } from 'vitest'
import { isUpiId, reminderText, upiLink } from './upi'

describe('UPI', () => {
  it.each(['riya.s@okhdfcbank', '9876543210@ybl', 'arjun_k@paytm'])('accepts %s', (id) => {
    expect(isUpiId(id)).toBe(true)
  })

  it.each(['riya', '@ybl', 'riya@', 'riya @ybl', 'riya@1bank'])('rejects %j', (id) => {
    expect(isUpiId(id)).toBe(false)
  })

  it('builds a pay link with payee, amount in rupees, INR and a note', () => {
    const link = upiLink({ upiId: 'riya@okaxis', name: 'Riya S', paise: 16800, note: 'Night Canteen Gang' })
    expect(link).toBe('upi://pay?pa=riya%40okaxis&pn=Riya%20S&am=168.00&cu=INR&tn=Night%20Canteen%20Gang')
  })

  it('writes a reminder with the amount and link', () => {
    expect(reminderText({ from: 'Arjun', to: 'Riya', paise: 16800, groupName: 'Night Canteen Gang', link: 'upi://x' })).toBe(
      'Hey Arjun, you owe Riya ₹168.00 for Night Canteen Gang 🧾\nPay in one tap: upi://x\nSent from SplitSmart',
    )
  })
})
