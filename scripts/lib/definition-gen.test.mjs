import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { readVocab } from './passage-gen.mjs'
import {
  definitionId,
  definitionUserPrompt,
  formatDefinitions,
  leaksWord,
  planDefinitionJobs,
  toDefinitions,
  validateDefinitions,
} from './definition-gen.mjs'

const ROOT = new URL('../../', import.meta.url)

const job = {
  id: 'a1-u001-d1',
  level: 'a1',
  unit: 1,
  topic: 'fam',
  words: [
    { lemma: 'boy', pos: 'n', meaning: 'cậu bé', ipa: '/bɔɪ/', topic: 'fam' },
    { lemma: 'adult', pos: 'adj/n', meaning: 'người lớn', ipa: '/ˈædʌlt/', topic: 'fam' },
  ],
  itemIds: ['a1-u001-boy', 'a1-u001-adult'],
}
const good = {
  definitions: [
    { word: 'adult', definition: 'a person who is fully grown' },
    { word: 'boy', definition: 'a young male child' },
  ],
}

describe('planDefinitionJobs', () => {
  it('makes one job per unit with an id for each word', () => {
    const jobs = planDefinitionJobs('a1', readVocab('a1', ROOT))
    expect(jobs[0].id).toBe('a1-u001-d1')
    expect(jobs[0].itemIds).toContain('a1-u001-aunt')
    expect(jobs.every((j) => j.words.length <= 20 && j.itemIds.length === j.words.length)).toBe(true)
  })

  it('covers every word of every level exactly once', () => {
    for (const level of ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']) {
      const rows = readVocab(level, ROOT)
      const ids = planDefinitionJobs(level, rows).flatMap((j) => j.itemIds)
      expect(ids).toHaveLength(rows.length)
      expect(new Set(ids).size).toBe(rows.length)
    }
  })
})

describe('leaksWord', () => {
  it('spots the word and its simple inflections', () => {
    expect(leaksWord('to teach people', 'teach')).toBe(true)
    expect(leaksWord('a person who teaches', 'teach')).toBe(true)
    expect(leaksWord('a baby boy', 'baby')).toBe(true)
    expect(leaksWord('more than one babies', 'baby')).toBe(true)
    expect(leaksWord('sweet food made with ice cream', 'ice cream')).toBe(true)
  })

  it('leaves unrelated words and short parts alone', () => {
    expect(leaksWord('a young male child', 'boy')).toBe(false)
    expect(leaksWord('a person who works at a school', 'teacher')).toBe(false)
    expect(leaksWord('to move towards a place', 'go to')).toBe(false)
    expect(leaksWord('a very good friend', 'go')).toBe(false)
  })
})

describe('validateDefinitions', () => {
  it('accepts a good answer', () => {
    expect(validateDefinitions(good, job)).toEqual([])
  })

  it('reports missing, extra, repeated and unknown words', () => {
    expect(validateDefinitions({ definitions: [good.definitions[1]] }, job).join()).toContain('"adult" has no definition')
    expect(validateDefinitions({ definitions: [...good.definitions, good.definitions[0]] }, job).join()).toContain('more than one')
    expect(validateDefinitions({ definitions: [...good.definitions, { word: 'cat', definition: 'a small pet' }] }, job).join()).toContain('not a target word')
  })

  it('rejects bad definitions', () => {
    const bad = (definition) => validateDefinitions({ definitions: [{ word: 'boy', definition }, good.definitions[0]] }, job)
    expect(bad('a young boy')).toHaveLength(1)
    expect(bad('a young male child.')).toHaveLength(1)
    expect(bad('child')).toHaveLength(1)
    expect(bad('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen')).toHaveLength(1)
    expect(bad('a young male child / son')).toHaveLength(1)
    expect(bad('a young  male child')).toHaveLength(1)
    expect(bad('một cậu bé nhỏ')).toHaveLength(1)
    expect(validateDefinitions(null, job)).toHaveLength(1)
  })
})

describe('toDefinitions', () => {
  it('follows the unit order and spells out the part of speech', () => {
    expect(toDefinitions(good, job)).toEqual([
      { id: 'a1-u001-boy', word: 'boy', pos: 'noun', def: 'a young male child' },
      { id: 'a1-u001-adult', word: 'adult', pos: 'adjective, noun', def: 'a person who is fully grown' },
    ])
    expect(definitionId('b1', 12, 'ice cream')).toBe('b1-u012-ice-cream')
  })

  it('formats one definition per line, sorted by unit', () => {
    const text = formatDefinitions([
      { id: 'a1-u002-x', word: 'x', pos: 'noun', def: 'b b' },
      { id: 'a1-u001-y', word: 'y', pos: 'noun', def: 'a a' },
    ])
    expect(text.split('\n')[1]).toContain('a1-u001-y')
    expect(JSON.parse(text)).toHaveLength(2)
  })
})

describe('definitionUserPrompt', () => {
  it('lists the words with part of speech and meaning', () => {
    const prompt = definitionUserPrompt(job, 'Family')
    expect(prompt).toContain('- boy (noun): cậu bé')
    expect(prompt).toContain('A1')
  })
})

describe('shipped definitions', () => {
  it('belong to words of the level, with ids from the plan', () => {
    for (const level of ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']) {
      const planned = new Set(planDefinitionJobs(level, readVocab(level, ROOT)).flatMap((j) => j.itemIds))
      const items = JSON.parse(readFileSync(new URL(`src/data/definitions/${level}.json`, ROOT), 'utf8'))
      for (const d of items) expect(planned.has(d.id), d.id).toBe(true)
    }
  })
})
