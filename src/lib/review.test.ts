import { describe, expect, it } from 'vitest'
import { blankHint, clozeFor, isCorrectAnswer } from './review'

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

describe('isCorrectAnswer', () => {
  it('accepts the form in the sentence or the dictionary form, ignoring case and spaces', () => {
    expect(isCorrectAnswer(' Cages ', 'cages', 'cage')).toBe(true)
    expect(isCorrectAnswer('cage', 'cages', 'cage')).toBe(true)
    expect(isCorrectAnswer('ice  cream', 'ice cream', 'ice cream')).toBe(true)
    expect(isCorrectAnswer('cags', 'cages', 'cage')).toBe(false)
    expect(isCorrectAnswer('', 'cages', 'cage')).toBe(false)
  })
})

describe('blankHint', () => {
  it('keeps the first letter and the spaces', () => {
    expect(blankHint('cages')).toBe('c____')
    expect(blankHint('ice cream')).toBe('i__ _____')
  })
})
