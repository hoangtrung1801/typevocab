import { describe, expect, it } from 'vitest'
import { markupKeys, parsePassage, revealedWordCount, stripMarkup } from '../lib/passage'
import { PASSAGES_BY_LEVEL } from '.'
import { LEVELS } from './types'

describe.each(LEVELS)('%s passages', (level) => {
  const passages = PASSAGES_BY_LEVEL[level]

  it('has 10 passages', () => {
    expect(passages).toHaveLength(10)
  })

  it.each(passages.map((p) => [p.title, p] as const))('%s is well formed', (_, p) => {
    expect(p.titleVi.trim()).not.toBe('')
    expect(p.sentences.length).toBeGreaterThanOrEqual(3)
    expect(p.sentences.length).toBeLessThanOrEqual(7)

    const used = p.sentences.flatMap((s) => markupKeys(s.en))
    const defined = Object.keys(p.vocab)
    expect(new Set(used)).toEqual(new Set(defined))
    expect(defined.length).toBeGreaterThanOrEqual(5)
    expect(defined.length).toBeLessThanOrEqual(8)

    for (const s of p.sentences) {
      expect(s.vi.trim()).not.toBe('')
      const plain = stripMarkup(s.en)
      expect(plain).not.toMatch(/[[\]|]/)
      expect(plain).toBe(plain.trim())
      expect(plain).not.toMatch(/ {2}/)
      // Plain ASCII keeps the text typeable on any keyboard.
      expect(plain).toMatch(/^[\x20-\x7e]+$/)
    }

    for (const [key, v] of Object.entries(p.vocab)) {
      expect(key).toBe(v.word.toLowerCase())
      expect(v.ipa).toMatch(/^\/.+\/$/)
      expect(v.vi.trim()).not.toBe('')
    }
  })
})

describe('parsePassage', () => {
  const parsed = parsePassage([
    { en: 'I soon [got used to|get used to] the [cages|cage].', vi: '' },
    { en: 'Done.', vi: '' },
  ])

  it('joins sentences with single spaces', () => {
    expect(parsed.text).toBe('I soon got used to the cages. Done.')
    expect(parsed.sentenceStarts).toEqual([0, 30])
  })

  it('tags every character of a phrase, spaces included', () => {
    const start = parsed.text.indexOf('got')
    const phrase = parsed.chars.slice(start, start + 'got used to'.length)
    expect(phrase.every((c) => c.vocab === 'get used to')).toBe(true)
  })

  it('anchors the tooltip on the first word of a span only', () => {
    const tagged = parsed.words.filter((w) => w.vocab === 'get used to')
    expect(tagged.map((w) => w.isFirst)).toEqual([true, false, false])
  })

  it('keeps trailing punctuation in the word', () => {
    const cages = parsed.words.find((w) => w.vocab === 'cage')!
    expect(cages.chars.map((i) => parsed.chars[i].ch).join('')).toBe('cages.')
    expect(parsed.vocabOrder).toEqual(['get used to', 'cage'])
  })

  it('assigns the space between sentences to the earlier sentence', () => {
    expect(parsed.chars[29].ch).toBe(' ')
    expect(parsed.chars[29].sentence).toBe(0)
  })
})

describe('revealedWordCount', () => {
  it('shows nothing before typing and everything once the sentence is typed', () => {
    expect(revealedWordCount(8, 0, 40)).toBe(0)
    expect(revealedWordCount(8, 40, 40)).toBe(8)
    expect(revealedWordCount(8, 55, 40)).toBe(8)
  })

  it('reveals words in proportion to progress, starting on the first keystroke', () => {
    expect(revealedWordCount(8, 1, 40)).toBe(1)
    expect(revealedWordCount(8, 20, 40)).toBe(4)
    expect(revealedWordCount(8, 39, 40)).toBe(8)
  })
})
