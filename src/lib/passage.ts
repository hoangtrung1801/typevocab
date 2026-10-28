import type { Sentence } from '../data/types'

export type Char = {
  ch: string
  /** Vocab key when this character belongs to a target word (spaces inside phrases included). */
  vocab: string | null
  sentence: number
  /** Index into `words`; a space belongs to the word before it. */
  word: number
}

export type Word = {
  /** Indexes into `chars` of the word's non-space characters. */
  chars: number[]
  /** Index of the space that follows the word, or -1 for the last word. */
  space: number
  vocab: string | null
  /** True on the first word of a target-word span, where the tooltip anchors. */
  isFirst: boolean
}

export type ParsedPassage = {
  text: string
  chars: Char[]
  words: Word[]
  /** Vocab keys in order of first appearance. */
  vocabOrder: string[]
  /** Index in `text` where each sentence starts. */
  sentenceStarts: number[]
}

const MARKUP = /\[([^\]|]+)(?:\|([^\]]+))?\]/g

export function stripMarkup(en: string): string {
  return en.replace(MARKUP, '$1')
}

export function markupKeys(en: string): string[] {
  return [...en.matchAll(MARKUP)].map((m) => (m[2] ?? m[1]).trim().toLowerCase())
}

export function parsePassage(sentences: Sentence[]): ParsedPassage {
  const chars: Char[] = []
  const vocabOrder: string[] = []
  const sentenceStarts: number[] = []

  const push = (ch: string, vocab: string | null, sentence: number) => {
    chars.push({ ch, vocab, sentence, word: -1 })
  }

  sentences.forEach((s, si) => {
    if (si > 0) push(' ', null, si - 1)
    sentenceStarts.push(chars.length)
    let last = 0
    for (const m of s.en.matchAll(MARKUP)) {
      for (const ch of s.en.slice(last, m.index)) push(ch, null, si)
      const key = (m[2] ?? m[1]).trim().toLowerCase()
      if (!vocabOrder.includes(key)) vocabOrder.push(key)
      for (const ch of m[1]) push(ch, key, si)
      last = m.index + m[0].length
    }
    for (const ch of s.en.slice(last)) push(ch, null, si)
  })

  const words: Word[] = []
  let current: Word | null = null
  chars.forEach((c, i) => {
    if (c.ch === ' ') {
      if (current) {
        current.space = i
        c.word = words.length - 1
        current = null
      }
      return
    }
    if (!current) {
      current = { chars: [], space: -1, vocab: null, isFirst: false }
      words.push(current)
    }
    current.chars.push(i)
    c.word = words.length - 1
    if (!current.vocab && c.vocab) current.vocab = c.vocab
  })
  words.forEach((w, i) => {
    w.isFirst = w.vocab !== null && (i === 0 || words[i - 1].vocab !== w.vocab)
  })

  return { text: chars.map((c) => c.ch).join(''), chars, words, vocabOrder, sentenceStarts }
}

export function wordsPerMinute(typedChars: number, seconds: number): number {
  if (seconds <= 0) return 0
  return Math.round(typedChars / 5 / (seconds / 60))
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
