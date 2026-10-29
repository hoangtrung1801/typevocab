import { describe, expect, it } from 'vitest'
import { answerLetters, answerSlots, clozeFor, hintOrder, isCorrectLetters, nextHintIndex } from './review'

const sentences = [
  { en: 'My [uncle] has a farm.', vi: 'Chú tôi có một trang trại.' },
  { en: 'We cleaned the [cages|cage] and ate [ice cream].', vi: 'Chúng tôi dọn chuồng và ăn kem.' },
]

describe('clozeFor', () => {
  it('blanks the marked word in the first sentence that has it', () => {
    expect(clozeFor(sentences, 'cage')).toEqual({
      before: 'We cleaned the ',
      answer: 'cages',
      after: ' and ate ice cream.',
      vi: 'Chúng tôi dọn chuồng và ăn kem.',
    })
    expect(clozeFor(sentences, 'uncle')).toMatchObject({ before: 'My ', answer: 'uncle', after: ' has a farm.' })
  })

  it('returns null when no sentence marks the word', () => {
    expect(clozeFor(sentences, 'aunt')).toBeNull()
  })
})

describe('letter boxes', () => {
  it('turns spaces into gaps and numbers the boxes', () => {
    expect(answerLetters('ice cream')).toBe('icecream')
    expect(answerSlots('ice cr')).toEqual([
      { gap: false, index: 0 },
      { gap: false, index: 1 },
      { gap: false, index: 2 },
      { gap: true },
      { gap: false, index: 3 },
      { gap: false, index: 4 },
    ])
  })

  it('checks every box, ignoring case', () => {
    expect(isCorrectLetters('Cages', 'cages')).toBe(true)
    expect(isCorrectLetters('monday', 'Monday')).toBe(true)
    expect(isCorrectLetters('cage', 'cages')).toBe(false)
    expect(isCorrectLetters('cagez', 'cages')).toBe(false)
  })
})

describe('hints', () => {
  it('reveals the first letter, then the last, then evenly spaced middle letters', () => {
    expect(hintOrder(1)).toEqual([0])
    expect(hintOrder(2)).toEqual([0, 1])
    expect(hintOrder(5)).toEqual([0, 4, 2, 1, 3])
    expect(hintOrder(12)).toEqual([0, 11, 5, 8, 2, 3, 6, 9, 1, 4, 7, 10])
    for (const n of [3, 7, 20]) expect([...hintOrder(n)].sort((a, b) => a - b)).toEqual([...Array(n).keys()])
  })

  it('skips letters already hinted or typed correctly', () => {
    expect(nextHintIndex('cages', '', new Set())).toBe(0)
    expect(nextHintIndex('cages', '', new Set([0]))).toBe(4)
    expect(nextHintIndex('cages', 'c', new Set())).toBe(4)
    expect(nextHintIndex('cages', 'xages', new Set([4]))).toBe(0)
    expect(nextHintIndex('cages', 'cages', new Set())).toBe(-1)
  })
})
