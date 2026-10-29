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

/** Letters, digits, apostrophes and hyphens are typed; other punctuation is filled in. */
export function isTypeable(ch: string): boolean {
  return /[A-Za-z0-9'-]/.test(ch)
}

/**
 * The characters to type, one box each. Spaces are gaps and punctuation such
 * as commas is shown, not typed, so "ice cream" is typed as "icecream" and
 * "On Sunday," as "OnSunday".
 */
export function answerLetters(answer: string): string {
  return [...answer].filter(isTypeable).join('')
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

export type Slot = { kind: 'box'; index: number } | { kind: 'fixed'; ch: string }

/** The answer as words, each a list of boxes (with their index in the letters) and fixed punctuation. */
export function answerWords(answer: string): Slot[][] {
  let index = 0
  return answer
    .split(' ')
    .filter(Boolean)
    .map((word) => [...word].map((ch): Slot => (isTypeable(ch) ? { kind: 'box', index: index++ } : { kind: 'fixed', ch })))
}

/** Positions typed wrong (or left empty) after checking. */
export function wrongPositions(typed: string, letters: string): Set<number> {
  const out = new Set<number>()
  for (let i = 0; i < letters.length; i++) if (!same(typed[i], letters[i])) out.add(i)
  return out
}

/**
 * For a phrase: the next hint goes to the first word that is not fully typed
 * correctly, in that word's first-last-middle order. -1 when nothing is left.
 */
export function nextWordHintIndex(answer: string, typed: string, hinted: Set<number>): number {
  const letters = answerLetters(answer)
  for (const word of answerWords(answer)) {
    const boxes = word.flatMap((s) => (s.kind === 'box' ? [s.index] : []))
    const open = boxes.filter((i) => !same(typed[i], letters[i]))
    if (open.length === 0) continue
    const next = hintOrder(boxes.length)
      .map((k) => boxes[k])
      .find((i) => !hinted.has(i) && !same(typed[i], letters[i]))
    if (next !== undefined) return next
  }
  return -1
}
