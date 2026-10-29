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
 * The order hints reveal positions in: first letter, last letter, then the
 * middle of the widest unrevealed stretch each time, so revealed letters stay
 * evenly spread. "octogenarian" -> 0, 11, 5, 8, 2, 3, 6, 9, 1, 4, 7, 10.
 */
export function hintOrder(length: number): number[] {
  if (length <= 0) return []
  const order = length === 1 ? [0] : [0, length - 1]
  while (order.length < length) {
    const sorted = [...order].sort((a, b) => a - b)
    let best = 0
    for (let i = 1; i < sorted.length - 1; i++) if (sorted[i + 1] - sorted[i] > sorted[best + 1] - sorted[best]) best = i
    order.push(Math.floor((sorted[best] + sorted[best + 1]) / 2))
  }
  return order
}

/**
 * The next position to show as a hint, skipping ones already hinted or already
 * typed correctly; -1 when there is nothing left to reveal.
 */
export function nextHintIndex(letters: string, typed: string, hinted: Set<number>): number {
  return hintOrder(letters.length).find((i) => !hinted.has(i) && !same(typed[i], letters[i])) ?? -1
}

/** Splits an answer into boxes and gaps, with each box's index in the letters. */
export function answerSlots(answer: string): ({ gap: true } | { gap: false; index: number })[] {
  let index = 0
  return [...answer].map((c) => (c === ' ' ? { gap: true as const } : { gap: false as const, index: index++ }))
}
