import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { warmUpOcr } from './lib/ocr'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Quietly cache the text reader after the first visit, so scanning works offline
// right away. Skipped on data-saver connections; it's only a few MB once.
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
if (navigator.onLine && !saveData) {
  window.addEventListener('load', () => setTimeout(() => void warmUpOcr().catch(() => {}), 10_000))
}
