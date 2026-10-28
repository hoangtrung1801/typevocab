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

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** The form used in the sentence and the dictionary form are both accepted. */
export function isCorrectAnswer(input: string, answer: string, lemma: string): boolean {
  const typed = normalize(input)
  return typed !== '' && (typed === normalize(answer) || typed === normalize(lemma))
}

/** "cages" -> "c____": the first letter as a hint, one underscore per other letter. */
export function blankHint(answer: string): string {
  return answer.charAt(0) + answer.slice(1).replace(/[^ ]/g, '_')
}
