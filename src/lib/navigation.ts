import { DRILLS_BY_LEVEL, PASSAGES_BY_LEVEL, pickPassage } from '../data'
import type { Level } from '../data/types'
import { getState, type PracticeMode } from './store'

/**
 * The page of a random item to practise next in a mode: a passage to copy or
 * a sentence to translate, preferring ones not done yet. Home when the level
 * has nothing for that mode.
 */
export function nextPath(mode: PracticeMode, level: Level, excludeId?: string): string {
  const s = getState()
  if (mode === 'translate') {
    const next = pickPassage(DRILLS_BY_LEVEL[level], (id) => Boolean(s.translateProgress[id]), excludeId)
    return next && next.id !== excludeId ? `/t/${next.id}` : '/'
  }
  const next = pickPassage(PASSAGES_BY_LEVEL[level], (id) => Boolean(s.progress[id]), excludeId)
  return next && next.id !== excludeId ? `/p/${next.id}` : '/'
}
