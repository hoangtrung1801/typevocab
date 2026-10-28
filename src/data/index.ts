import a1 from './passages/a1.json'
import a2 from './passages/a2.json'
import b1 from './passages/b1.json'
import b2 from './passages/b2.json'
import c1 from './passages/c1.json'
import { LEVELS, type Level, type Passage, type RawPassage } from './types'

// JSON imports infer a union of literal shapes; the content test checks the real structure.
const RAW = { A1: a1, A2: a2, B1: b1, B2: b2, C1: c1 } as unknown as Record<Level, RawPassage[]>

export const PASSAGES_BY_LEVEL: Record<Level, Passage[]> = Object.fromEntries(
  LEVELS.map((level) => [
    level,
    RAW[level].map((p, i) => ({
      ...p,
      level,
      number: i + 1,
      id: `${level.toLowerCase()}-${String(i + 1).padStart(2, '0')}`,
    })),
  ]),
) as Record<Level, Passage[]>

export const ALL_PASSAGES: Passage[] = LEVELS.flatMap((l) => PASSAGES_BY_LEVEL[l])

const BY_ID = new Map(ALL_PASSAGES.map((p) => [p.id, p]))

export function getPassage(id: string): Passage | undefined {
  return BY_ID.get(id)
}

export function nextPassage(p: Passage): Passage | undefined {
  return PASSAGES_BY_LEVEL[p.level][p.number]
}
