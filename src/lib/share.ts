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
export async function qrDataUrl(text: string, level: 'L' | 'M' = 'M'): Promise<string> {
  const QRCode = await import('qrcode')
  // Low error correction fits more data, for long group links
  return QRCode.toDataURL(text, { margin: 1, width: level === 'L' ? 360 : 280, errorCorrectionLevel: level })
}
