import { describe, expect, it } from 'vitest'
import { markupKeys, parsePassage, revealedChunkWords, revealedWordCount, stripMarkup } from '../lib/passage'
import { sentenceTiles } from '../lib/scramble'
import { DEFINITIONS_BY_LEVEL, DRILLS_BY_LEVEL, PASSAGES_BY_LEVEL } from '.'
import { LEVELS } from './types'

describe.each(LEVELS)('%s passages', (level) => {
  const passages = PASSAGES_BY_LEVEL[level]

  it('has passages with unique ids for this level', () => {
    expect(passages.length).toBeGreaterThan(0)
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length)
    for (const p of passages) expect(p.id).toMatch(new RegExp(`^${level.toLowerCase()}-u\\d{3}-\\d+$`))
  })

  it.each(passages.map((p) => [p.title, p] as const))('%s is well formed', (_, p) => {
    expect(p.titleVi.trim()).not.toBe('')
    expect(p.sentences.length).toBeGreaterThanOrEqual(3)
    expect(p.sentences.length).toBeLessThanOrEqual(7)

    const used = p.sentences.flatMap((s) => markupKeys(s.en))
    const defined = Object.keys(p.vocab)
    expect(new Set(used)).toEqual(new Set(defined))
    expect(defined.length).toBeGreaterThanOrEqual(4)
    expect(defined.length).toBeLessThanOrEqual(8)

    for (const s of p.sentences) {
      expect(s.vi.trim()).not.toBe('')

      // Phrase alignment: same number of phrases on both sides, no empty
      // phrase, no markup split across phrases, longer sentences split up.
      expect(s.viChunks).toHaveLength(s.enChunks.length)
      expect(s.enChunks.join(' ')).toBe(stripMarkup(s.en))
      for (const c of [...s.enChunks, ...s.viChunks]) expect(c).toBe(c.trim())
      for (const c of s.enChunks) expect(c).not.toMatch(/[[\]|/]/)
      for (const c of s.viChunks) expect(c).not.toMatch(/^$|\//)
      if (stripMarkup(s.en).split(' ').length > 5) expect(s.enChunks.length).toBeGreaterThan(1)
      const plain = stripMarkup(s.en)
      expect(plain).not.toMatch(/[[\]|]/)
      expect(plain).toBe(plain.trim())
      expect(plain).not.toMatch(/ {2}/)
      // Plain ASCII keeps the text typeable on any keyboard.
      expect(plain).toMatch(/^[\x20-\x7e]+$/)
    }

    for (const [key, v] of Object.entries(p.vocab)) {
      expect(key).toBe(v.word.toLowerCase())
      expect(v.ipa).toMatch(/^(\/.+\/)?$/)
      expect(v.vi.trim()).not.toBe('')
    }
  })
})

describe.each(LEVELS)('%s reverse translation sentences', (level) => {
  const drills = DRILLS_BY_LEVEL[level]

  it('has sentences with unique ids for this level', () => {
    expect(drills.length).toBeGreaterThan(0)
    expect(new Set(drills.map((d) => d.id)).size).toBe(drills.length)
    for (const d of drills) expect(d.id).toMatch(new RegExp(`^${level.toLowerCase()}-u\\d{3}-[a-z0-9-]+$`))
  })

  it.each(drills.map((d) => [d.id, d] as const))('%s is well formed', (_, d) => {
    // One target word, marked once, with its entry.
    const keys = markupKeys(d.en)
    expect(keys).toHaveLength(1)
    expect(Object.keys(d.vocab)).toEqual(keys)
    expect(d.vocab[keys[0]].vi.trim()).not.toBe('')

    const plain = stripMarkup(d.en)
    expect(plain).toMatch(/^[\x20-\x7e]+$/)
    expect(plain).toMatch(/^[A-Z].*[.?!]$/)
    expect(plain).not.toMatch(/ {2}|[[\]|/]/)
    // Short enough to rebuild from a shuffled word bank.
    const words = sentenceTiles(d.en).length
    expect(words).toBeGreaterThanOrEqual(4)
    expect(words).toBeLessThanOrEqual(12)
    expect(d.vi.trim()).not.toBe('')
  })
})

describe('parsePassage', () => {
  const parsed = parsePassage([
    { en: 'I soon [got used to|get used to] the [cages|cage].' },
    { en: 'Done.' },
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

describe('revealedChunkWords', () => {
  // "Last month," / "I sent" / "an application"  ->  "Tháng trước," / "tôi gửi" / "đơn ứng tuyển"
  const en = [11, 6, 14]
  const vi = [2, 2, 3]

  it('reveals each Vietnamese phrase while its English phrase is typed', () => {
    expect(revealedChunkWords(en, vi, 0)).toBe(0)
    expect(revealedChunkWords(en, vi, 11)).toBe(2)
    expect(revealedChunkWords(en, vi, 12)).toBe(2)
    expect(revealedChunkWords(en, vi, 13)).toBe(3)
    expect(revealedChunkWords(en, vi, 18)).toBe(4)
    expect(revealedChunkWords(en, vi, 32)).toBe(7)
  })
})

describe.each(LEVELS)('%s English definitions', (level) => {
  it('defines each word once, without giving the word away', () => {
    const words = DEFINITIONS_BY_LEVEL[level].map((d) => d.word.toLowerCase())
    expect(new Set(words).size).toBe(words.length)
    for (const d of DEFINITIONS_BY_LEVEL[level]) {
      expect(d.id).toMatch(new RegExp(`^${level.toLowerCase()}-u\\d{3}-[a-z0-9-]+$`))
      expect(d.def, d.id).toMatch(/^[\x20-\x7e]+$/)
      expect(d.def.split(/\s+/).length, d.id).toBeGreaterThanOrEqual(2)
      expect(d.def.split(/\s+/).length, d.id).toBeLessThanOrEqual(18)
      expect(d.def, d.id).not.toMatch(/[.!?[\]|/]$|\s{2}|^\s|\s$/)
      expect(d.def.toLowerCase().split(/[^a-z]+/), d.id).not.toContain(d.word.toLowerCase())
    }
  })
})
