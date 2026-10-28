import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cleanIpa,
  parseCsv,
  planJobs,
  posLabel,
  readVocab,
  splitEvenly,
  toPassage,
  validateGenerated,
} from './passage-gen.mjs'

const ROOT = new URL('../../', import.meta.url)

const job = {
  id: 'a1-u001-1',
  level: 'a1',
  unit: 1,
  part: 1,
  topic: 'fam',
  words: [
    { lemma: 'baby', pos: 'n', meaning: 'em bé', ipa: '/ˈbeɪbi/', topic: 'fam' },
    { lemma: 'uncle', pos: 'n', meaning: 'chú, bác, cậu', ipa: '/ˈʌŋkəl/', topic: 'fam' },
  ],
}

const good = {
  title: 'A Family Visit',
  titleVi: 'Chuyến thăm gia đình',
  sentences: [
    { chunks: [{ en: 'My [uncle] visits us', vi: 'Chú tôi đến thăm chúng tôi' }, { en: 'every Sunday.', vi: 'mỗi Chủ nhật.' }] },
    { chunks: [{ en: 'He brings', vi: 'Chú mang' }, { en: 'a toy for the [baby].', vi: 'một món đồ chơi cho em bé.' }] },
    { chunks: [{ en: 'We are happy.', vi: 'Chúng tôi vui.' }] },
  ],
}

describe('vocabulary', () => {
  it('parses quoted CSV fields', () => {
    expect(parseCsv('a,b\n1,"x, ""y"""\n')).toEqual([{ a: '1', b: 'x, "y"' }])
  })

  it('cleans IPA and names parts of speech', () => {
    expect(cleanIpa('/ˈtwɛnti/ [-ɛɾ̃i]')).toBe('/ˈtwɛnti/')
    expect(cleanIpa('')).toBe('')
    expect(posLabel('n/v')).toBe('noun, verb')
  })

  it('reads every level file with the expected columns', () => {
    for (const level of ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']) {
      const rows = readVocab(level, ROOT)
      expect(rows.length).toBeGreaterThan(500)
      for (const r of rows) {
        expect(r.unit).toBeGreaterThan(0)
        expect(r.lemma).not.toBe('')
        expect(r.meaning).not.toBe('')
        expect(r.ipa).toMatch(/^(\/[^/]+\/)?$/)
      }
    }
  })
})

describe('planning', () => {
  it('splits into the fewest even groups of at most 8', () => {
    expect(splitEvenly([...'abcdefgh']).map((g) => g.length)).toEqual([8])
    expect(splitEvenly([...'abcdefghi']).map((g) => g.length)).toEqual([5, 4])
    expect(splitEvenly([...'abcdefghijklmn']).map((g) => g.length)).toEqual([7, 7])
  })

  it('covers every word of a level exactly once, with stable ids', () => {
    const rows = readVocab('b1', ROOT)
    const jobs = planJobs('b1', rows)
    expect(jobs.flatMap((j) => j.words).length).toBe(rows.length)
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length)
    expect(jobs[0].id).toBe('b1-u001-1')
    for (const j of jobs) expect(j.words.length).toBeLessThanOrEqual(8)
  })
})

describe('validateGenerated', () => {
  it('accepts a correct answer and builds the passage', () => {
    expect(validateGenerated(good, job)).toEqual([])
    const p = toPassage(good, job)
    expect(p.sentences[0]).toEqual({ en: 'My [uncle] visits us / every Sunday.', vi: 'Chú tôi đến thăm chúng tôi / mỗi Chủ nhật.' })
    expect(p.vocab.uncle).toEqual({ word: 'uncle', pos: 'noun', ipa: '/ˈʌŋkəl/', vi: 'chú, bác, cậu' })
  })

  const broken = (edit) => {
    const copy = structuredClone(good)
    edit(copy)
    return validateGenerated(copy, job).join('\n')
  }

  it('reports missing, unknown and repeated target words', () => {
    expect(broken((o) => (o.sentences[1].chunks[1].en = 'a toy for the child.'))).toMatch(/"baby" is missing/)
    expect(broken((o) => (o.sentences[2].chunks[0].en = 'We are [happy].'))).toMatch(/"happy" is marked but is not a target/)
    expect(broken((o) => (o.sentences[2].chunks[0].en = 'The [baby] laughs.'))).toMatch(/"baby" is marked more than once/)
  })

  it('reports long sentences without phrases, non-ASCII text and slashes', () => {
    expect(
      broken((o) => (o.sentences[0].chunks = [{ en: 'My [uncle] visits us every Sunday.', vi: 'Chú tôi đến thăm mỗi Chủ nhật.' }])),
    ).toMatch(/only one chunk/)
    expect(broken((o) => (o.sentences[0].chunks[1].en = 'every Sunday — always.'))).toMatch(/non-ASCII/)
    expect(broken((o) => (o.sentences[0].chunks[1].vi = 'mỗi Chủ nhật / tuần.'))).toMatch(/"\/" is not allowed/)
  })

  it('rejects answers that are not passages', () => {
    expect(validateGenerated(null, job)).toEqual(['The answer is not a JSON object.'])
    expect(broken((o) => (o.sentences = o.sentences.slice(0, 2)))).toMatch(/3 to 8 sentences/)
  })
})

describe('generated passages in src/data/passages', () => {
  it.each(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])('%s uses exactly the words of its vocabulary unit', (level) => {
    const passages = JSON.parse(readFileSync(new URL(`src/data/passages/${level}.json`, ROOT), 'utf8'))
    const jobs = new Map(planJobs(level, readVocab(level, ROOT)).map((j) => [j.id, j]))
    for (const p of passages) {
      const job = jobs.get(p.id)
      expect(job, `${p.id} is not a unit of ${level}`).toBeDefined()
      expect(p.unit).toBe(job.unit)
      expect(p.topic).toBe(job.topic)
      expect(p.vocab).toEqual(toPassage({ title: 'x', titleVi: 'x', sentences: [] }, job).vocab)
    }
  })
})
