/**
 * Monkeytype-style typing engine. Pure functions over an immutable state so
 * the rules can be unit tested without a DOM.
 *
 * - Input is per word. Space moves to the next word (ignored on an empty word).
 * - Letters past the end of a word are kept as "extra" letters.
 * - Backspace may step back into the previous word only if it has mistakes.
 * - The test ends when the last word is typed correctly, or on space after it.
 */

export type TypingState = {
  words: string[]
  /** What the user typed for each word up to and including the current one. */
  typed: string[]
  current: number
  keystrokes: number
  correctKeystrokes: number
  /** Indexes of words that received at least one wrong keystroke. */
  errorWords: number[]
  startedAt: number | null
  finishedAt: number | null
}

export type LetterState = 'correct' | 'incorrect' | 'extra' | 'untyped'

export type Letter = { ch: string; state: LetterState }

/** Extra letters allowed past the end of a word. */
export const MAX_EXTRA = 10

export function initTyping(words: string[]): TypingState {
  return {
    words,
    typed: [''],
    current: 0,
    keystrokes: 0,
    correctKeystrokes: 0,
    errorWords: [],
    startedAt: null,
    finishedAt: null,
  }
}

function markError(errorWords: number[], i: number): number[] {
  return errorWords.includes(i) ? errorWords : [...errorWords, i]
}

export function typeChar(s: TypingState, ch: string, now: number): TypingState {
  if (s.finishedAt !== null) return s
  const word = s.words[s.current]
  const input = s.typed[s.current]
  const last = s.current === s.words.length - 1
  const startedAt = s.startedAt ?? now

  if (ch === ' ') {
    if (input === '') return s
    const ok = input === word
    const next: TypingState = {
      ...s,
      startedAt,
      keystrokes: s.keystrokes + 1,
      correctKeystrokes: s.correctKeystrokes + (ok ? 1 : 0),
      errorWords: ok ? s.errorWords : markError(s.errorWords, s.current),
    }
    if (last) return { ...next, finishedAt: now }
    return { ...next, current: s.current + 1, typed: [...s.typed, ''] }
  }

  if (input.length >= word.length + MAX_EXTRA) return s
  const ok = input.length < word.length && word[input.length] === ch
  const typed = [...s.typed]
  typed[s.current] = input + ch
  return {
    ...s,
    typed,
    startedAt,
    keystrokes: s.keystrokes + 1,
    correctKeystrokes: s.correctKeystrokes + (ok ? 1 : 0),
    errorWords: ok ? s.errorWords : markError(s.errorWords, s.current),
    finishedAt: last && typed[s.current] === word ? now : null,
  }
}

export function backspace(s: TypingState, wholeWord = false): TypingState {
  if (s.finishedAt !== null) return s
  const input = s.typed[s.current]
  if (input !== '') {
    const typed = [...s.typed]
    typed[s.current] = wholeWord ? '' : input.slice(0, -1)
    return { ...s, typed }
  }
  const prev = s.current - 1
  if (prev < 0 || s.typed[prev] === s.words[prev]) return s
  const typed = s.typed.slice(0, s.current)
  if (wholeWord) typed[prev] = ''
  return { ...s, typed, current: prev }
}

export function letters(s: TypingState, i: number): Letter[] {
  const word = s.words[i]
  const input = i <= s.current ? s.typed[i] : ''
  const out: Letter[] = []
  for (let j = 0; j < word.length; j++) {
    if (j < input.length) out.push({ ch: word[j], state: input[j] === word[j] ? 'correct' : 'incorrect' })
    else out.push({ ch: word[j], state: 'untyped' })
  }
  for (let j = word.length; j < input.length; j++) out.push({ ch: input[j], state: 'extra' })
  return out
}

/** A finished word (one the caret has left) that does not match. */
export function isWordWrong(s: TypingState, i: number): boolean {
  const done = i < s.current || (s.finishedAt !== null && i === s.current)
  return done && s.typed[i] !== s.words[i]
}

export type Stats = {
  wpm: number
  raw: number
  /** 0–100 */
  acc: number
  seconds: number
}

export function stats(s: TypingState, now: number): Stats {
  const end = s.finishedAt ?? now
  const seconds = s.startedAt === null ? 0 : Math.max(0, (end - s.startedAt) / 1000)
  const lastIndex = s.words.length - 1

  // wpm counts only correctly typed words, plus the spaces after them.
  let correctChars = 0
  let rawChars = 0
  for (let i = 0; i <= s.current; i++) {
    const finished = i < s.current || s.finishedAt !== null
    const space = i < lastIndex && i < s.current ? 1 : 0
    rawChars += s.typed[i].length + space
    if (finished && s.typed[i] === s.words[i]) correctChars += s.words[i].length + space
  }
  const minutes = seconds / 60
  return {
    wpm: minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0,
    raw: minutes > 0 ? Math.round(rawChars / 5 / minutes) : 0,
    acc: s.keystrokes > 0 ? Math.round((100 * s.correctKeystrokes) / s.keystrokes) : 100,
    seconds,
  }
}
