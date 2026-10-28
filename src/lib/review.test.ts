import { describe, expect, it } from 'vitest'
import { answerLetters, answerSlots, clozeFor, isCorrectLetters, nextHint } from './review'

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

describe('nextHint', () => {
  it('adds the next letter after a correct start', () => {
    expect(nextHint('', 'cages')).toEqual({ value: 'c', revealed: 0 })
    expect(nextHint('ca', 'cages')).toEqual({ value: 'cag', revealed: 2 })
  })

  it('fixes the first wrong letter and drops what follows', () => {
    expect(nextHint('cxges', 'cages')).toEqual({ value: 'ca', revealed: 1 })
  })

  it('reports nothing left to reveal once the word is complete', () => {
    expect(nextHint('cages', 'cages')).toEqual({ value: 'cages', revealed: -1 })
  })
})
