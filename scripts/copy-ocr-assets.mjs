// Copies Tesseract's worker and engine into public/tesseract so OCR loads from
// our own site (and works offline once cached) instead of a CDN.
// Runs before `npm run dev` and `npm run build`; the copies aren't committed.
import { copyFileSync, mkdirSync } from 'node:fs'

const out = 'public/tesseract'
mkdirSync(out, { recursive: true })
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`)
// We only use the LSTM engine; one of these is picked by what the phone's CPU supports
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  copyFileSync(`node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`, `${out}/tesseract-core-${variant}.wasm.js`)
}
console.log('OCR engine copied to public/tesseract')
