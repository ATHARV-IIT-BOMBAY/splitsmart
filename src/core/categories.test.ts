import { describe, expect, it } from 'vitest'
import { itemKey, mainCategory, pickCategory, receiptCategories } from './categories'

describe('categories', () => {
  it('maps the model’s top label to a category', () => {
    expect(pickCategory(['food, a snack or a drink', 'groceries or household supplies'], [0.81, 0.1])).toBe('Food')
  })

  it('falls back to Other when the model isn’t confident', () => {
    expect(pickCategory(['travel, transport, a cab or fuel'], [0.24])).toBe('Other')
    expect(pickCategory([], [])).toBe('Other')
  })

  it('matches item names regardless of case and spacing', () => {
    expect(itemKey('  PNR  Seekh-Kabab ')).toBe(itemKey('pnr seekh kabab'))
  })

  it('an expense takes the category it spent the most on', () => {
    expect(
      mainCategory([
        { category: 'Food', totalPaise: 30000 },
        { category: 'Groceries', totalPaise: 20000 },
        { category: 'Groceries', totalPaise: 20000 },
        { totalPaise: 90000 },
      ]),
    ).toBe('Groceries')
    expect(mainCategory([{ totalPaise: 100 }])).toBeUndefined()
  })

  it('uses the whole-receipt answer when it agrees with most items', () => {
    // Gulmohar: the model calls a few dishes "Entertainment", but the bill is clearly Food
    expect(receiptCategories(['Food', 'Entertainment', 'Food', 'Travel'], 'Food')).toEqual(['Food', 'Food', 'Food', 'Food'])
    // Zepto: whole-list answer disagrees with the items, so items keep their own
    expect(receiptCategories(['Food', 'Food', 'Groceries'], 'Entertainment')).toEqual(['Food', 'Food', 'Groceries'])
  })
})
