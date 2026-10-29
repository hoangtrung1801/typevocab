import a1 from './passages/a1.json'
import a2 from './passages/a2.json'
import b1 from './passages/b1.json'
import b2 from './passages/b2.json'
import c1 from './passages/c1.json'
import c2 from './passages/c2.json'
import { stripMarkup } from '../lib/passage'
import { LEVELS, type Level, type Passage, type RawPassage, type RawSentence, type Sentence } from './types'

// JSON imports infer a union of literal shapes; the content test checks the real structure.
const RAW = { A1: a1, A2: a2, B1: b1, B2: b2, C1: c1, C2: c2 } as unknown as Record<Level, RawPassage[]>

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

/**
 * A random passage to type next: one not typed yet if any are left, never the
 * passage just typed (unless it is the only one).
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
