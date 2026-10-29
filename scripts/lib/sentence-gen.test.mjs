import { describe, expect, it } from 'vitest'
import { readVocab } from './passage-gen.mjs'
import { formatSentences, planSentenceJobs, sentenceUserPrompt, slug, toSentences, validateSentences, wordCount } from './sentence-gen.mjs'

const ROOT = new URL('../../', import.meta.url)

const job = {
  id: 'a1-u001-s1',
  level: 'a1',
  unit: 1,
  topic: 'fam',
  words: [
    { lemma: 'baby', pos: 'n', meaning: 'em bé', ipa: '/ˈbeɪbi/', topic: 'fam' },
    { lemma: 'uncle', pos: 'n', meaning: 'chú, bác, cậu', ipa: '/ˈʌŋkəl/', topic: 'fam' },
  ],
  itemIds: ['a1-u001-baby', 'a1-u001-uncle'],
}

const good = {
  sentences: [
    { word: 'uncle', en: 'My [uncle] lives near the sea.', vi: 'Chú tôi sống gần biển.' },
    { word: 'baby', en: 'The [babies|baby] are sleeping now.', vi: 'Các em bé đang ngủ.' },
  ],
}

describe('planSentenceJobs', () => {
  it('makes one job per unit with an id for each word', () => {
    const jobs = planSentenceJobs('a1', readVocab('a1', ROOT))
    expect(jobs[0].id).toBe('a1-u001-s1')
    expect(jobs[0].itemIds).toContain('a1-u001-aunt')
    expect(jobs[0].itemIds).toHaveLength(jobs[0].words.length)
    for (const j of jobs) expect(j.words.length).toBeLessThanOrEqual(12)
    expect(new Set(jobs.flatMap((j) => j.itemIds)).size).toBe(jobs.reduce((n, j) => n + j.words.length, 0))
  })

  it('slugs lemmas for ids', () => {
    expect(slug("Ice-Cream O'Clock")).toBe('ice-cream-o-clock')
  })
})

describe('validateSentences', () => {
  it('accepts a good answer', () => {
    expect(validateSentences(good, job)).toEqual([])
  })

  it('reports missing, extra and repeated words', () => {
    const out = { sentences: [good.sentences[0], good.sentences[0], { word: 'dog', en: 'A [dog] runs fast now.', vi: 'Chó chạy.' }] }
    const problems = validateSentences(out, job).join('\n')
    expect(problems).toMatch(/"uncle" has more than one sentence/)
    expect(problems).toMatch(/"dog" is not a target word/)
    expect(problems).toMatch(/Target word "baby" has no sentence/)
  })

  it('checks markup, length, ASCII and sentence shape', () => {
    const bad = (en) => validateSentences({ sentences: [{ word: 'uncle', en, vi: 'x' }, good.sentences[1]] }, job).join('\n')
    expect(bad('My uncle lives near the sea.')).toMatch(/must mark "uncle" exactly once/)
    expect(bad('My [uncle] and my [baby] sleep.')).toMatch(/must mark "uncle" exactly once/)
    expect(bad('My [uncle] lives in a very big old house near the quiet blue sea.')).toMatch(/has 14 words; use 4 to 12/)
    expect(bad('My [uncle] is.')).toMatch(/has 3 words/)
    expect(bad('My [uncle] lives in a café.')).toMatch(/non-ASCII/)
    expect(bad('my [uncle] lives near the sea')).toMatch(/capital letter and end/)
  })

  it('counts words as the word bank does', () => {
    expect(wordCount('On Sunday, we ate [ice cream] - yum!')).toBe(7)
  })
})

describe('toSentences', () => {
  it('builds items in the unit order with the vocab entry from the CSV', () => {
    const items = toSentences(good, job)
    expect(items.map((s) => s.id)).toEqual(['a1-u001-baby', 'a1-u001-uncle'])
    expect(items[0]).toEqual({
      id: 'a1-u001-baby',
      unit: 1,
      topic: 'fam',
      en: 'The [babies|baby] are sleeping now.',
      vi: 'Các em bé đang ngủ.',
      vocab: { baby: { word: 'baby', pos: 'noun', ipa: '/ˈbeɪbi/', vi: 'em bé' } },
    })
  })

  it('formats one sentence per line, sorted by unit', () => {
    const items = toSentences(good, job)
    const text = formatSentences([{ ...items[0], id: 'a1-u002-x', unit: 2 }, ...items])
    expect(text.split('\n')).toHaveLength(6)
    expect(JSON.parse(text).map((s) => s.id)).toEqual(['a1-u001-baby', 'a1-u001-uncle', 'a1-u002-x'])
  })

  it('prompts with the level length guide', () => {
    expect(sentenceUserPrompt(job, 'Gia đình')).toMatch(/4-8 words per sentence/)
  })
})
