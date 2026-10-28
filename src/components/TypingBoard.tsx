import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Passage } from '../data/types'
import type { ParsedPassage } from '../lib/passage'
import { isWordWrong, letters, type TypingState } from '../lib/typing'

type Props = {
  passage: Passage
  parsed: ParsedPassage
  state: TypingState
  onChar: (ch: string) => void
  onBackspace: (wholeWord: boolean) => void
  onRestart: () => void
  onFinishConfirm: () => void
  onFocusChange: (focused: boolean) => void
}

const VISIBLE_LINES = 3
const TOOLTIP_WIDTH = 280

/**
 * The passage shown three lines at a time, Monkeytype style: a caret that
 * glides between letters, lines that scroll up as you go, and a blur when the
 * hidden input loses focus. Target words carry a highlighter mark and show
 * their meaning when the caret reaches them or the mouse hovers them.
 */
export default function TypingBoard({ passage, parsed, state, onChar, onBackspace, onRestart, onFinishConfirm, onFocusChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const linesRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const blinkTimer = useRef<number | undefined>(undefined)
  const [focused, setFocused] = useState(false)
  const [hover, setHover] = useState<string | null>(null)

  const done = state.finishedAt !== null
  const activeVocab = done ? null : parsed.words[state.current].vocab
  const tipKey = hover ?? activeVocab
  const tip = tipKey ? passage.vocab[tipKey] : null

  // Latest callbacks for the native listeners, which are bound once.
  const handlers = useRef({ onChar, onBackspace, onRestart, onFinishConfirm, done })
  useEffect(() => {
    handlers.current = { onChar, onBackspace, onRestart, onFinishConfirm, done }
  })

  const pauseBlink = useCallback(() => {
    const caret = caretRef.current
    if (!caret) return
    caret.classList.remove('caret-blink')
    window.clearTimeout(blinkTimer.current)
    blinkTimer.current = window.setTimeout(() => caret.classList.add('caret-blink'), 600)
  }, [])

  // Typing goes through `beforeinput` so the input stays empty and every
  // keystroke, including Backspace and Ctrl/Alt+Backspace, maps to an action.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const typeAll = (text: string) => {
      for (const ch of text) handlers.current.onChar(ch === ' ' ? ' ' : ch)
      pauseBlink()
    }
    const onBeforeInput = (e: InputEvent) => {
      if (e.isComposing || e.inputType === 'insertCompositionText') return
      e.preventDefault()
      if (e.inputType === 'insertText' && e.data) typeAll(e.data)
      else if (e.inputType === 'deleteContentBackward') {
        handlers.current.onBackspace(false)
        pauseBlink()
      } else if (e.inputType.startsWith('delete') && e.inputType.endsWith('Backward')) {
        handlers.current.onBackspace(true)
        pauseBlink()
      }
    }
    // IME / mobile keyboards that compose text: take the result, then clear.
    const onCompositionEnd = (e: CompositionEvent) => {
      if (e.data) typeAll(e.data)
      input.value = ''
    }
    const onInput = (e: Event) => {
      if ((e as InputEvent).isComposing || !input.value) return
      typeAll(input.value)
      input.value = ''
    }
    input.addEventListener('beforeinput', onBeforeInput)
    input.addEventListener('compositionend', onCompositionEnd)
    input.addEventListener('input', onInput)
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput)
      input.removeEventListener('compositionend', onCompositionEnd)
      input.removeEventListener('input', onInput)
    }
  }, [pauseBlink])

  // Any key pressed while the page has no focused field brings focus back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (active === inputRef.current) return
      if (active && ['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(active.tagName)) return
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    return () => window.clearTimeout(blinkTimer.current)
  }, [])

  // Place the caret, scroll the lines and position the tooltip after layout.
  const layoutRef = useRef(() => {})
  function layout() {
    const lines = linesRef.current
    const caret = caretRef.current
    const wrapper = wrapperRef.current
    if (!lines || !caret || !wrapper) return
    const lineHeight = parseFloat(getComputedStyle(lines).lineHeight) || 52

    const word = lines.querySelector<HTMLElement>(`[data-word="${state.current}"]`)
    if (!word) return
    const chars = word.querySelectorAll<HTMLElement>('[data-letter]')
    const index = Math.min(state.typed[state.current].length, chars.length)
    const ref = chars[Math.min(index, chars.length - 1)]
    const x = index < chars.length ? ref.offsetLeft : ref.offsetLeft + ref.offsetWidth
    const y = ref.offsetTop
    caret.style.height = `${ref.offsetHeight}px`
    caret.style.transform = `translate(${x - 1}px, ${y}px)`

    const line = Math.floor((word.offsetTop + 1) / lineHeight)
    const offset = Math.max(0, line - 1) * lineHeight
    lines.style.transform = `translateY(${-offset}px)`

    const tipEl = tipRef.current
    if (tipEl) {
      const anchor = tipKey ? lines.querySelector<HTMLElement>(`[data-vocab-first="${CSS.escape(tipKey)}"]`) : null
      const top = anchor ? anchor.offsetTop - offset : -1
      if (!anchor || top < 0 || top >= VISIBLE_LINES * lineHeight) {
        tipEl.style.visibility = 'hidden'
      } else {
        const maxLeft = Math.max(0, wrapper.clientWidth - TOOLTIP_WIDTH)
        tipEl.style.visibility = 'visible'
        tipEl.style.left = `${Math.min(Math.max(anchor.offsetLeft - 10, 0), maxLeft)}px`
        tipEl.style.top = `${top + 4}px`
      }
    }
  }

  useLayoutEffect(() => {
    layoutRef.current = layout
    layout()
  })

  // Turn on the glide only after the first placement, so the caret does not
  // slide in from the corner.
  useEffect(() => {
    caretRef.current?.classList.add('caret-blink')
    const id = requestAnimationFrame(() => {
      caretRef.current?.classList.add('caret-animate')
      linesRef.current?.classList.add('lines-animate')
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const relayout = () => layoutRef.current()
    window.addEventListener('resize', relayout)
    document.fonts?.ready.then(relayout)
    return () => window.removeEventListener('resize', relayout)
  }, [])

  const wordMeta = useMemo(
    () =>
      parsed.words.map((w) => ({
        vocab: w.vocab,
        // Only the first word of a target phrase anchors the tooltip.
        first: w.isFirst,
        // Per letter, so punctuation next to a target word stays unmarked.
        letterVocab: w.chars.map((c) => parsed.chars[c].vocab),
        sentence: parsed.chars[w.chars[0]].sentence,
      })),
    [parsed],
  )

  const currentSentence = wordMeta[state.current].sentence

  const setFocus = (f: boolean) => {
    setFocused(f)
    onFocusChange(f)
  }

  return (
    <div ref={wrapperRef} className="relative" onMouseDown={(e) => {
      if (e.target !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }}>
      <input
        ref={inputRef}
        type="text"
        defaultValue=""
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault()
            handlers.current.onRestart()
          } else if (e.key === 'Enter' && handlers.current.done) {
            e.preventDefault()
            handlers.current.onFinishConfirm()
          }
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Ô nhập: gõ lại đoạn văn tiếng Anh"
        className="absolute top-0 left-0 size-px border-0 p-0 text-base opacity-0"
      />

      <div
        className={`typing-viewport relative overflow-hidden transition-[filter,opacity] duration-200 ${focused ? '' : 'opacity-50 blur-[3px]'}`}
        aria-hidden="true"
      >
        <div ref={linesRef} className="ruled relative font-mono text-[19px] sm:text-2xl">
          {wordMeta.map(({ vocab, first, letterVocab, sentence }, i) => {
            const wrong = isWordWrong(state, i)
            const inSentence = sentence === currentSentence
            const mark = vocab ? (vocab === tipKey ? 'mark-full' : 'mark-soft') : ''
            return (
              <span key={i}>
                <span
                  data-word={i}
                  data-vocab-first={first && vocab ? vocab : undefined}
                  onMouseEnter={vocab ? () => setHover(vocab) : undefined}
                  onMouseLeave={vocab ? () => setHover(null) : undefined}
                  className={`inline-block ${wrong ? 'word-error' : ''} ${inSentence ? 'word-current-sentence' : ''}`}
                >
                  {letters(state, i).map((l, j) => (
                    <span key={j} data-letter="" className={`letter letter-${l.state} ${letterVocab[j] ? mark : ''}`}>
                      {l.ch}
                    </span>
                  ))}
                </span>{' '}
              </span>
            )
          })}
          <span ref={caretRef} className="caret absolute top-0 left-0" style={{ visibility: done ? 'hidden' : 'visible' }} />
        </div>
      </div>

      {!focused && !done && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-[3px] bg-paper/90 px-4 py-2 text-[17px] text-ink">
            Bấm vào đây hoặc nhấn phím bất kỳ để gõ
          </span>
        </div>
      )}

      <div
        ref={tipRef}
        role="tooltip"
        style={{ width: TOOLTIP_WIDTH, visibility: 'hidden' }}
        className="tooltip-in pointer-events-none absolute z-10 flex -translate-y-full flex-col gap-1 rounded-[3px] border border-rule border-t-[3px] border-t-red bg-card px-4 pt-3 pb-3.5 leading-snug text-ink shadow-card"
        key={tipKey ?? 'none'}
      >
        {tip && (
          <>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[22px] font-semibold">{tip.word}</span>
              <span className="font-mono text-sm font-bold text-red">{passage.level}</span>
            </span>
            <span className="font-mono text-sm text-pencil">
              {tip.ipa} · {tip.pos}
            </span>
            <span lang="vi" className="text-lg">
              {tip.vi}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
