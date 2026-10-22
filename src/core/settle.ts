import type { Paise } from './money'
import type { MemberId } from './types'

export interface Transfer {
  from: MemberId
  to: MemberId
  paise: Paise
}

/** Above this many people with non-zero balances we fall back to greedy. */
export const MAX_EXACT_PEOPLE = 20

/**
 * The fewest payments that settle every balance.
 *
 * Key fact: if people can be split into k separate subgroups whose balances
 * each add up to zero, everyone settles in (n − k) payments, because a
 * subgroup of size s needs s − 1 payments. So the fewest payments is
 * n − (largest possible k).
 *
 * We find the largest k exactly with a bitmask DP over subsets in
 * O(2ⁿ · n): dp[mask] is the most zero-sum subgroups we can carve out of
 * `mask`. Inside each subgroup the biggest debtor pays the biggest creditor.
 *
 * Plain greedy is not always minimal: balances +600, +400, −300, −300, −400
 * take 4 greedy payments but only 3 here (−400 → +400, both −300 → +600).
 */
export function settleUp(balances: Record<MemberId, Paise>): Transfer[] {
  const people = Object.entries(balances).filter(([, paise]) => paise !== 0)
  if (people.length > MAX_EXACT_PEOPLE) return greedy(people)

  const groups = zeroSumGroups(people.map(([, paise]) => paise))
  return groups.flatMap((group) => greedy(group.map((i) => people[i])))
}

/** Splits indices into the largest number of subgroups that each sum to 0. */
function zeroSumGroups(amounts: readonly Paise[]): number[][] {
  const n = amounts.length
  const full = (1 << n) - 1
  const sum = new Float64Array(1 << n) // paise totals are exact integers in a double
  const dp = new Int8Array(1 << n)

  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask
    sum[mask] = sum[mask ^ low] + amounts[31 - Math.clz32(low)]
    let best = 0
    for (let rest = mask; rest; rest &= rest - 1) {
      best = Math.max(best, dp[mask ^ (rest & -rest)])
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0)
  }

  // Walk back from the full set, removing one person at a time along an
  // optimal path. Each time the remaining set sums to 0, the people removed
  // since the last such point form one zero-sum subgroup.
  const groups: number[][] = []
  let current: number[] = []
  let mask = full
  while (mask) {
    const target = dp[mask] - (sum[mask] === 0 ? 1 : 0)
    let bit = 0
    for (let rest = mask; rest; rest &= rest - 1) {
      bit = rest & -rest
      if (dp[mask ^ bit] === target) break
    }
    current.push(31 - Math.clz32(bit))
    mask ^= bit
    if (sum[mask] === 0) {
      groups.push(current)
      current = []
    }
  }
  return groups
}

/** Repeatedly lets the biggest debtor pay the biggest creditor. */
function greedy(people: ReadonlyArray<readonly [MemberId, Paise]>): Transfer[] {
  const left = people.map(([id, paise]) => ({ id, paise }))
  const transfers: Transfer[] = []
  for (;;) {
    let debtor = left[0]
    let creditor = left[0]
    for (const p of left) {
      if (p.paise < debtor.paise) debtor = p
      if (p.paise > creditor.paise) creditor = p
    }
    if (!debtor || debtor.paise >= 0) return transfers
    const paise = Math.min(-debtor.paise, creditor.paise)
    transfers.push({ from: debtor.id, to: creditor.id, paise })
    debtor.paise += paise
    creditor.paise -= paise
  }
}
