import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts ship with the app (no Google Fonts request), so text renders fast and offline
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { warmUpOcr } from './lib/ocr'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Quietly cache the text reader after the first visit, so scanning works offline
// right away. Skipped on data-saver connections; it's only a few MB once.
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
if (navigator.onLine && !saveData) {
  window.addEventListener('load', () => setTimeout(() => void warmUpOcr().catch(() => {}), 10_000))
}
