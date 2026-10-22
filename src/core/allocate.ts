import type { Paise } from './money'

/**
 * Splits `total` paise in proportion to `weights` so the parts add up to
 * `total` exactly. Every split in the app goes through this one function.
 *
 * Rounding rule (largest remainder method):
 * 1. Everyone gets their exact share rounded down to the paisa.
 * 2. The leftover paise go, one each, to the largest fractional remainders.
 * 3. Ties go to whoever comes first in `priority` (a list of indices).
 *    Callers pass the payer first, then members in join order.
 *
 * Example: allocate(10000, [1, 1, 1]) → [3334, 3333, 3333].
 *
 * Negative totals (discounts) are split the same way and returned negative.
 * Weights must be non-negative integers; use basis points for percentages.
 */
export function allocate(
  total: Paise,
  weights: readonly number[],
  priority: readonly number[] = weights.map((_, i) => i),
): Paise[] {
  if (!Number.isSafeInteger(total)) {
    throw new RangeError(`Total must be a whole number of paise, got ${total}`)
  }
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new RangeError('Weights must be non-negative whole numbers')
  }
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  if (weightSum === 0) {
    if (total === 0) return weights.map(() => 0)
    throw new RangeError('Cannot split a non-zero amount when every weight is zero')
  }

  // BigInt keeps total × weight exact even for large bills.
  const amount = BigInt(Math.abs(total))
  const divisor = BigInt(weightSum)
  const floors = weights.map((w) => (amount * BigInt(w)) / divisor)
  const remainders = weights.map((w) => (amount * BigInt(w)) % divisor)
  let leftover = Number(amount - floors.reduce((sum, f) => sum + f, 0n))

  const rank = new Map(priority.map((index, position) => [index, position]))
  const rankOf = (i: number) => rank.get(i) ?? priority.length + i
  const order = weights
    .map((_, i) => i)
    .filter((i) => weights[i] > 0)
    .sort((a, b) => {
      if (remainders[a] !== remainders[b]) return remainders[a] > remainders[b] ? -1 : 1
      return rankOf(a) - rankOf(b)
    })

  const parts = floors.map(Number)
  for (const i of order) {
    if (leftover === 0) break
    parts[i] += 1
    leftover -= 1
  }
  // `0 - x` rather than `-x` so a zero share stays +0, not -0.
  return total < 0 ? parts.map((p) => 0 - p) : parts
}
