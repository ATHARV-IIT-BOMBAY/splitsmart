/**
 * Shares text the way phones expect: the system share sheet (WhatsApp,
 * Telegram, Messages…) where available, otherwise WhatsApp on the web.
 */
export async function shareText(text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return
    } catch (error) {
      // The user closing the share sheet isn't an error worth falling back from
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

/** QR code for any text, as an image URL. The library loads only when needed. */
export async function qrDataUrl(text: string): Promise<string> {
  const QRCode = await import('qrcode')
  return QRCode.toDataURL(text, { margin: 1, width: 280, errorCorrectionLevel: 'M' })
}
