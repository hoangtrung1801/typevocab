import { useRef, useState } from 'react'
import type { Passage } from '../data/types'
import type { ParsedPassage } from '../lib/passage'
import VocabTooltip from './VocabTooltip'

type Props = {
  passage: Passage
  parsed: ParsedPassage
  typed: string
  focused: boolean
  inputId: string
}

/**
 * The passage on ruled paper. Typed characters turn dark, target words carry a
 * highlighter mark, and the word under the caret (or the mouse) shows its meaning.
 * Mistakes are not checked: every keystroke simply advances the caret.
 */
export default function TypingText({ passage, parsed, typed, focused, inputId }: Props) {
  const boundsRef = useRef<HTMLLabelElement>(null)
  const [hover, setHover] = useState<string | null>(null)

  const { chars, words, text } = parsed
  const done = typed.length >= text.length
  const pos = Math.min(typed.length, text.length - 1)
  const activeVocab = done ? null : words[chars[pos].word].vocab

  const charClass = (i: number) => {
    const c = chars[i]
    let cls = i < typed.length ? 'text-ink' : 'text-faint'
    if (c.vocab) cls += c.vocab === activeVocab || c.vocab === hover ? ' mark-full' : ' mark-soft'
    if (i === typed.length && !done) cls += focused ? ' caret caret-blink' : ' caret'
    return cls
  }

  return (
    <label
      ref={boundsRef}
      htmlFor={inputId}
      className="ruled block cursor-text font-mono text-[19px] whitespace-pre-wrap sm:text-2xl"
    >
      {words.map((w, wi) => {
        const showTip = w.isFirst && w.vocab !== null && (w.vocab === activeVocab || w.vocab === hover)
        return (
          <span key={wi}>
            <span
              className="relative"
              onMouseEnter={w.vocab ? () => setHover(w.vocab) : undefined}
              onMouseLeave={w.vocab ? () => setHover(null) : undefined}
            >
              {w.chars.map((i) => (
                <span key={i} className={charClass(i)}>
                  {chars[i].ch}
                </span>
              ))}
              {showTip && <VocabTooltip key={w.vocab} entry={passage.vocab[w.vocab!]} level={passage.level} boundsRef={boundsRef} />}
            </span>
            {w.space >= 0 && <span className={charClass(w.space)}> </span>}
          </span>
        )
      })}
    </label>
  )
}
