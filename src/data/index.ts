import a1 from './passages/a1.json'
import a2 from './passages/a2.json'
import b1 from './passages/b1.json'
import b2 from './passages/b2.json'
import c1 from './passages/c1.json'
import c2 from './passages/c2.json'
import sa1 from './sentences/a1.json'
import sa2 from './sentences/a2.json'
import sb1 from './sentences/b1.json'
import sb2 from './sentences/b2.json'
import sc1 from './sentences/c1.json'
import sc2 from './sentences/c2.json'
import da1 from './definitions/a1.json'
import da2 from './definitions/a2.json'
import db1 from './definitions/b1.json'
import db2 from './definitions/b2.json'
import dc1 from './definitions/c1.json'
import dc2 from './definitions/c2.json'
import { stripMarkup } from '../lib/passage'
import { LEVELS, type Definition, type Drill, type Level, type Passage, type RawDrill, type RawPassage, type RawSentence, type Sentence } from './types'

// JSON imports infer a union of literal shapes; the content test checks the real structure.
const RAW = { A1: a1, A2: a2, B1: b1, B2: b2, C1: c1, C2: c2 } as unknown as Record<Level, RawPassage[]>
const RAW_DRILLS = { A1: sa1, A2: sa2, B1: sb1, B2: sb2, C1: sc1, C2: sc2 } as unknown as Record<Level, RawDrill[]>

export const DEFINITIONS_BY_LEVEL = { A1: da1, A2: da2, B1: db1, B2: db2, C1: dc1, C2: dc2 } as unknown as Record<Level, Definition[]>

export const CHUNK_SEPARATOR = ' / '

export function toSentence(raw: RawSentence): Sentence {
  const en = raw.en.split(CHUNK_SEPARATOR)
  const viChunks = raw.vi.split(CHUNK_SEPARATOR)
  return { en: en.join(' '), vi: viChunks.join(' '), enChunks: en.map(stripMarkup), viChunks }
}

export const PASSAGES_BY_LEVEL: Record<Level, Passage[]> = Object.fromEntries(
  LEVELS.map((level) => [
    level,
    RAW[level].map((p, i) => ({
      ...p,
      sentences: p.sentences.map(toSentence),
      level,
      number: i + 1,
    })),
  ]),
) as Record<Level, Passage[]>

export const ALL_PASSAGES: Passage[] = LEVELS.flatMap((l) => PASSAGES_BY_LEVEL[l])

const BY_ID = new Map(ALL_PASSAGES.map((p) => [p.id, p]))

export function getPassage(id: string): Passage | undefined {
  return BY_ID.get(id)
}

/** Sentences for reverse translation, separate from the passages for copy typing. */
export const DRILLS_BY_LEVEL: Record<Level, Drill[]> = Object.fromEntries(
  LEVELS.map((level) => [level, RAW_DRILLS[level].map((d) => ({ ...d, level }))]),
) as Record<Level, Drill[]>

const DRILL_BY_ID = new Map(LEVELS.flatMap((l) => DRILLS_BY_LEVEL[l]).map((d) => [d.id, d]))

export function getDrill(id: string): Drill | undefined {
  return DRILL_BY_ID.get(id)
}

/** Where a saved word came from: a passage or a reverse translation sentence. */
export function getSource(id: string): { path: string; title: string; sentences: { en: string; vi: string }[] } | undefined {
  const passage = getPassage(id)
  if (passage) return { path: `/p/${id}`, title: passage.title, sentences: passage.sentences }
  const drill = getDrill(id)
  if (drill) return { path: `/t/${id}`, title: stripMarkup(drill.en), sentences: [drill] }
  return undefined
}

/**
 * A random passage or sentence to do next: one not done yet if any are left,
 * never the one just done (unless it is the only one).
 */
export function pickPassage<T extends { id: string }>(
  passages: T[],
  done: (id: string) => boolean,
  excludeId?: string,
  random: () => number = Math.random,
): T | undefined {
  const others = passages.filter((p) => p.id !== excludeId)
  if (others.length === 0) return passages[0]
  const fresh = others.filter((p) => !done(p.id))
  const pool = fresh.length ? fresh : others
  return pool[Math.floor(random() * pool.length)]
}

const DEFINITIONS = new Map(
  LEVELS.flatMap((level) => DEFINITIONS_BY_LEVEL[level].map((d) => [`${level}:${d.word.toLowerCase()}`, d.def] as const)),
)

/** The word explained in English, for guessing it; undefined until definitions are generated for it. */
export function getDefinition(level: Level, word: string): string | undefined {
  return DEFINITIONS.get(`${level}:${word.toLowerCase()}`)
}
