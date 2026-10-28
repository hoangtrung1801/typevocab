import { describe, expect, it } from 'vitest'
import { backspace, initTyping, isWordWrong, letters, MAX_EXTRA, stats, typeChar, type TypingState } from './typing'

const type = (s: TypingState, text: string, start = 0) =>
  [...text].reduce((acc, ch, i) => typeChar(acc, ch, start + i * 100), s)

describe('typing engine', () => {
  const fresh = () => initTyping(['the', 'cat', 'sat'])

  it('marks correct and incorrect letters against the expected word', () => {
    const s = type(fresh(), 'tha')
    expect(letters(s, 0)).toEqual([
      { ch: 't', state: 'correct' },
      { ch: 'h', state: 'correct' },
      { ch: 'e', state: 'incorrect' },
    ])
    expect(letters(s, 1).every((l) => l.state === 'untyped')).toBe(true)
  })

  it('keeps extra letters past the end of the word, up to a limit', () => {
    const s = type(fresh(), 'thexx')
    expect(letters(s, 0).slice(3)).toEqual([
      { ch: 'x', state: 'extra' },
      { ch: 'x', state: 'extra' },
    ])
    const capped = type(fresh(), 'the' + 'x'.repeat(MAX_EXTRA + 5))
    expect(capped.typed[0]).toHaveLength(3 + MAX_EXTRA)
  })

  it('ignores space at the start of a word and advances otherwise', () => {
    expect(typeChar(fresh(), ' ', 0)).toEqual(fresh())
    const s = type(fresh(), 'th ')
    expect(s.current).toBe(1)
    expect(isWordWrong(s, 0)).toBe(true)
    expect(s.errorWords).toEqual([0])
  })

  it('only lets backspace return to a previous word that has mistakes', () => {
    const correct = type(fresh(), 'the ')
    expect(backspace(correct).current).toBe(1)

    const wrong = type(fresh(), 'teh ')
    const back = backspace(wrong)
    expect(back.current).toBe(0)
    expect(back.typed).toEqual(['teh'])
    expect(backspace(back).typed).toEqual(['te'])
  })

  it('deletes a whole word with ctrl+backspace', () => {
    expect(backspace(type(fresh(), 'the ca'), true).typed).toEqual(['the', ''])
    expect(backspace(type(fresh(), 'tx '), true)).toMatchObject({ current: 0, typed: [''] })
  })

  it('finishes when the last word is typed correctly', () => {
    const s = type(fresh(), 'the cat sat')
    expect(s.finishedAt).not.toBeNull()
    expect(typeChar(s, 'x', 99999)).toBe(s)
  })

  it('finishes on space after a wrong last word', () => {
    const s = type(fresh(), 'the cat sad')
    expect(s.finishedAt).toBeNull()
    const done = typeChar(s, ' ', 5000)
    expect(done.finishedAt).toBe(5000)
    expect(isWordWrong(done, 2)).toBe(true)
  })

  it('computes accuracy from keystrokes and wpm from correct words only', () => {
    // 11 keystrokes 100 ms apart: 1 second from first to last.
    const s = type(fresh(), 'the cat sat')
    const st = stats(s, 0)
    expect(st.acc).toBe(100)
    expect(st.seconds).toBe(1)
    expect(st.wpm).toBe(Math.round(11 / 5 / (1 / 60)))

    // The wrong "x" and the space after the wrong word are both misses.
    const withError = type(fresh(), 'thx cat sat')
    const st2 = stats(withError, 0)
    expect(st2.acc).toBe(Math.round((100 * 9) / 11))
    // "thx" does not count towards wpm but does towards raw.
    expect(st2.wpm).toBeLessThan(st2.raw)
  })
})
