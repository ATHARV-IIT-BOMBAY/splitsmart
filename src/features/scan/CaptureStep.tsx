import { useEffect, useRef, useState } from 'react'
import { button } from '../../components/styles'
import { loadPhoto } from '../../lib/image'

/** Lets the user take a photo with the camera or pick one from the device. */
export function CaptureStep({ onPhoto }: { onPhoto: (photo: ImageBitmap) => void }) {
  const [camera, setCamera] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function openPhoto(file: Blob) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && file.type !== '') {
      return setError('That file isn’t a photo. Choose a JPG or PNG of the receipt.')
    }
    try {
      onPhoto(await loadPhoto(file))
    } catch {
      setError('This photo couldn’t be opened. Try another one, or a JPG or PNG.')
    }
  }

  return (
    <div className="space-y-4">
      {camera ? (
        <Camera
          onCapture={(blob) => {
            setCamera(false)
            void openPhoto(blob)
          }}
          onError={(message) => {
            setCamera(false)
            setError(message)
          }}
        />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">
            🧾
          </p>
          <p className="mt-3 text-lg font-bold">Scan a receipt</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
            Lay it flat in good light. It’s read on this phone and never uploaded.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              className={button.primary}
              onClick={() => {
                setError('')
                setCamera(true)
              }}
            >
              Take photo
            </button>
            <button type="button" className={button.secondary} onClick={() => fileInput.current?.click()}>
              Upload photo
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void openPhoto(file)
        }}
      />
      {error && (
        <div role="alert" className="rounded-xl border border-owes/40 bg-owes/10 p-3 text-sm text-owes">
          {error}{' '}
          <button type="button" className="font-semibold underline" onClick={() => fileInput.current?.click()}>
            Upload a photo instead
          </button>
        </div>
      )}
    </div>
  )
}

function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return 'Camera access is blocked. Allow it in your browser settings, or upload a photo.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found on this device.'
  return 'The camera couldn’t start.'
}

function Camera({ onCapture, onError }: { onCapture: (photo: Blob) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  // Keep the latest callback without restarting the camera on every render
  const reportError = useRef(onError)
  useEffect(() => {
    reportError.current = onError
  })

  useEffect(() => {
    const onError = (message: string) => reportError.current(message)
    if (!navigator.mediaDevices?.getUserMedia) {
      onError('This browser can’t open the camera here.')
      return
    }
    let stream: MediaStream | undefined
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch((err) => !cancelled && onError(cameraError(err)))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function capture() {
    const v = video.current
    if (!v?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.92)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        onLoadedData={() => setReady(true)}
        className="aspect-[3/4] w-full object-cover sm:aspect-video"
        aria-label="Camera preview"
      />
      {/* Guide frame for lining up the receipt */}
      <div className="pointer-events-none absolute inset-x-[15%] inset-y-[8%] rounded-xl border-2 border-dashed border-white/70" />
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <button
          type="button"
          onClick={capture}
          aria-label="Capture photo"
          className="size-16 rounded-full border-4 border-white bg-white/30 transition active:scale-95"
        />
      </div>
      {!ready && <p className="absolute inset-0 grid place-items-center text-white/80">Starting camera…</p>}
    </div>
  )
}
