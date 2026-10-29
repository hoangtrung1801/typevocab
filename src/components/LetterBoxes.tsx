import { useState, type KeyboardEvent, type RefObject } from 'react'
import { answerSlots } from '../lib/review'

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
 * One box per letter of the answer, with gaps for spaces. A transparent input
 * on top takes the typing, so tapping any box opens the keyboard on phones.
 */
export default function LetterBoxes({ answer, letters, typed, hinted, revealed, onChange, onKeyDown, inputRef }: Props) {
  const [focused, setFocused] = useState(false)

  const boxClass = (i: number) => {
    const base =
      'flex h-12 w-9 items-center justify-center rounded-[3px] border-2 font-mono text-2xl sm:h-14 sm:w-11 sm:text-[28px]'
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
    <div className="relative inline-flex max-w-full flex-wrap items-center gap-1.5">
      {answerSlots(answer).map((slot, k) =>
        slot.gap ? (
          <span key={k} className="w-3" aria-hidden="true" />
        ) : (
          <span key={k} className={boxClass(slot.index)} aria-hidden="true">
            {content(slot.index)}
          </span>
        ),
      )}
      {!revealed && (
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, '').slice(0, letters.length))}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={letters.length}
          aria-label={`Gõ từ tiếng Anh, ${letters.length} ký tự`}
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
