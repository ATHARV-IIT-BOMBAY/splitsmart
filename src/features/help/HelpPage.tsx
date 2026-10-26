import { button, card } from '../../components/styles'
import { href } from '../../lib/router'

const SCAN_TIPS = [
  'Lay the receipt flat on a dark table.',
  'Use good lighting and avoid shadows.',
  'Hold your phone still and keep the text straight.',
]

export function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-4">
      <a href={href()} className={button.ghost}>
        ← All groups
      </a>

      <h1 className="text-2xl font-extrabold leading-tight">Help</h1>

      <section className={`${card} p-5`} aria-labelledby="help-what">
        <h2 id="help-what" className="text-lg font-bold">
          What SplitSmart does
        </h2>
        <p className="mt-2 text-ink-soft">
          SplitSmart helps you share costs with friends, housemates, or on trips. Just scan a receipt, pick who had
          what, and we’ll do the math for who owes who.
        </p>
      </section>

      <section className={`${card} p-5`} aria-labelledby="help-scan">
        <h2 id="help-scan" className="text-lg font-bold">
          How to get a good scan
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
          {SCAN_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
      </section>

      <section className={`${card} p-5`} aria-labelledby="help-settle">
        <h2 id="help-settle" className="text-lg font-bold">
          How settle-up works
        </h2>
        <p className="mt-2 text-ink-soft">
          We simplify who owes who so you make fewer transfers. Instead of paying everyone back one by one, you just
          make a single payment to clear your balance.
        </p>
      </section>

      <section className={`${card} p-5`} aria-labelledby="help-privacy">
        <h2 id="help-privacy" className="text-lg font-bold">
          Privacy
        </h2>
        <p className="mt-2 text-ink-soft">
          Everything happens right on your phone. We never save your photos or send your personal info anywhere else.
        </p>
      </section>
    </main>
  )
}
