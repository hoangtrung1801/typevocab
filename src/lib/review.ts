import { stripMarkup } from './passage'

export type Cloze = {
  /** English text before and after the blank. */
  before: string
  after: string
  /** The word as it appears in the sentence, e.g. "cages" for "cage". */
  answer: string
  vi: string
}

const MARKUP = /\[([^\]|]+)(?:\|([^\]]+))?\]/g

/** The first sentence that marks `key`, with that word blanked out. */
export function clozeFor(sentences: { en: string; vi: string }[], key: string): Cloze | null {
  for (const s of sentences) {
    for (const m of s.en.matchAll(MARKUP)) {
      if ((m[2] ?? m[1]).trim().toLowerCase() !== key) continue
      return {
        before: stripMarkup(s.en.slice(0, m.index)),
        answer: m[1],
        after: stripMarkup(s.en.slice(m.index + m[0].length)),
        vi: s.vi,
      }
    }
  }
  return null
}

/**
 * The characters to type, one box each. Spaces in a phrase are gaps, not
 * boxes, so "ice cream" is 8 letters typed as "icecream".
 */
export function answerLetters(answer: string): string {
  return answer.replace(/ /g, '')
}

const same = (a: string | undefined, b: string | undefined) => a?.toLowerCase() === b?.toLowerCase()

/** True when every box holds the right letter (case does not matter). */
export function isCorrectLetters(typed: string, letters: string): boolean {
  return typed.length === letters.length && [...letters].every((c, i) => same(typed[i], c))
}

/**
 * One more letter of help: keeps the correct start of what was typed, fixes
 * the first wrong letter or adds the next one, and drops anything after it.
 * Returns the new input and the position that was revealed (-1 when complete).
 */
export function nextHint(typed: string, letters: string): { value: string; revealed: number } {
  let i = 0
  while (i < letters.length && same(typed[i], letters[i])) i++
  if (i >= letters.length) return { value: typed.slice(0, letters.length), revealed: -1 }
  return { value: typed.slice(0, i) + letters[i], revealed: i }
}

/** Splits an answer into boxes and gaps, with each box's index in the letters. */
export function answerSlots(answer: string): ({ gap: true } | { gap: false; index: number })[] {
  let index = 0
  return [...answer].map((c) => (c === ' ' ? { gap: true as const } : { gap: false as const, index: index++ }))
}
