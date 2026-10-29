import { useState, type KeyboardEvent, type RefObject } from 'react'
import { answerWords, isTypeable } from '../lib/review'

type Props = {
  answer: string
  letters: string
  typed: string
  /** Positions whose letter a hint shows, faintly, until the box is typed in. */
  hinted: Set<number>
  /** After checking: boxes show the right letters, wrong ones in red. */
  revealed: boolean
  onChange: (value: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  inputRef: RefObject<HTMLInputElement | null>
}

/**
 * One box per letter of the answer, grouped by word so a word never breaks
 * across lines; punctuation is shown in place, not typed. A transparent input
 * on top takes the typing, so tapping any box opens the keyboard on phones.
 */
export default function LetterBoxes({
  answer,
  letters,
  typed,
  hinted,
  revealed,
  onChange,
  onKeyDown,
  inputRef,
}: Props) {
  const [focused, setFocused] = useState(false)

  const boxClass = (i: number) => {
    const base = `flex items-center justify-center rounded-[3px] border-2 font-mono h-12 w-9 text-2xl sm:h-14 sm:w-11 sm:text-[28px]`
    if (revealed) {
      const right = typed[i]?.toLowerCase() === letters[i].toLowerCase()
      if (!right) return `${base} border-red bg-card text-red`
      return `${base} border-ink text-ink ${hinted.has(i) ? 'bg-marker-soft' : 'bg-card'}`
    }
    if (focused && i === Math.min(typed.length, letters.length - 1)) return `${base} border-ink bg-card text-ink`
    if (i < typed.length) return `${base} border-rule bg-card text-ink`
    return `${base} border-rule bg-paper text-ink`
  }

  const content = (i: number) => {
    if (revealed) return letters[i]
    if (typed[i] !== undefined) return typed[i]
    // A hint is a placeholder: shown faintly, never typed in for the learner.
    return hinted.has(i) ? <span className="text-untyped">{letters[i]}</span> : ''
  }

  return (
    <div className="relative flex max-w-full flex-wrap items-end gap-x-4 gap-y-2">
      {answerWords(answer).map((word, w) => (
        <span key={w} className="flex items-end gap-1" aria-hidden="true">
          {word.map((slot, k) =>
            slot.kind === 'fixed' ? (
              <span key={k} className="font-mono text-[28px] text-pencil">
                {slot.ch}
              </span>
            ) : (
              <span key={k} className={boxClass(slot.index)}>
                {content(slot.index)}
              </span>
            ),
          )}
        </span>
      ))}
      {!revealed && (
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => onChange([...e.target.value].filter(isTypeable).join('').slice(0, letters.length))}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={letters.length}
          aria-label={`Gõ tiếng Anh, ${letters.length} ký tự`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="absolute inset-0 h-full w-full cursor-text border-0 bg-transparent p-0 text-base text-transparent caret-transparent opacity-0 focus-visible:outline-none"
        />
      )}
    </div>
  )
}
