import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickPassage, PASSAGES_BY_LEVEL } from '../data'
import type { Passage } from '../data/types'
import { formatTime, stripMarkup } from '../lib/passage'
import {
  isCorrectOrder,
  matchTiles,
  nextWordHint,
  properWords,
  sentenceTiles,
  shuffleTiles,
  typedWords,
} from '../lib/scramble'
import { play } from '../lib/sound'
import { canSpeak, speak } from '../lib/speech'
import { getState, saveTranslateResult, setLastLevel, setPracticeMode, useStore } from '../lib/store'
import BackLink from './BackLink'
import ModeToggle from './ModeToggle'
import Page from './Page'
import Paper from './Paper'

type Outcome = { status: 'first' | 'fixed' | 'revealed'; hints: number }

/** Called from event handlers only; kept outside the component for clarity. */
const timestamp = () => Date.now()

const isClean = (o: Outcome) => o.status === 'first' && o.hints === 0

/**
 * Reverse translation: each English sentence is broken into its words, shown
 * shuffled in a word bank under the Vietnamese sentence, and the learner types
 * the English sentence back in the right order, checking with Enter. A hint
 * numbers the tile of the next word to type.
 */
export default function TranslateSession({ passage }: { passage: Passage }) {
  const navigate = useNavigate()
  const soundOn = useStore((s) => s.soundOn)
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hinted, setHinted] = useState<Set<number>>(() => new Set())
  /** The typed words at the last failed check, shown against the answer. */
  const [checked, setChecked] = useState<string[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({})
  /** Bumped on retry so the bank is shuffled differently. */
  const [round, setRound] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  const sentences = passage.sentences
  const sentence = sentences[index]
  const answer = stripMarkup(sentence.en)
  const tiles = sentenceTiles(sentence.en, properWords(sentences.map((s) => s.en)))
  const bank = shuffleTiles(tiles, `${passage.id}:${index}:${round}`)
  const typed = typedWords(input)
  const { used, unknown } = matchTiles(tiles, typed)
  const hintAt = nextWordHint(tiles, typed, hinted)
  const done = finishedAt !== null
  // The check result counts while the words checked are still the ones typed.
  const failed = checked !== null && checked.join(' ') === typed.join(' ')

  useEffect(() => setLastLevel(passage.level), [passage.level])

  useEffect(() => {
    if (done) return
    if (revealed) continueRef.current?.focus()
    else inputRef.current?.focus()
  }, [index, revealed, done])

  const record = (outcome: Outcome) => setOutcomes((o) => ({ ...o, [index]: outcome }))

  const resetSentence = () => {
    setInput('')
    setHinted(new Set())
    setChecked(null)
    setRevealed(false)
    setAttempts(0)
  }

  /** `outcome` is the result of the sentence just finished, when not yet in state. */
  const advance = (outcome?: Outcome) => {
    if (soundOn && canSpeak()) speak(answer)
    resetSentence()
    if (index < sentences.length - 1) return setIndex(index + 1)

    const end = timestamp()
    setFinishedAt(end)
    if (soundOn) play('bell')
    const all = outcome ? { ...outcomes, [index]: outcome } : outcomes
    const clean = Object.values(all).filter(isClean).length
    saveTranslateResult(passage.id, {
      score: Math.round((100 * clean) / sentences.length),
      seconds: Math.round((end - (startedAt ?? end)) / 1000),
      completedAt: new Date(end).toISOString(),
    })
  }

  const check = () => {
    if (revealed) return advance()
    if (typed.length === 0) return
    if (isCorrectOrder(tiles, typed)) {
      const outcome: Outcome = { status: attempts === 0 ? 'first' : 'fixed', hints: hinted.size }
      record(outcome)
      if (soundOn) play('space')
      advance(outcome)
    } else {
      setAttempts((a) => a + 1)
      setChecked(typed)
      if (soundOn) play('error')
    }
  }

  const showAnswer = () => {
    record({ status: 'revealed', hints: hinted.size })
    setRevealed(true)
  }

  const hint = () => {
    if (revealed || hintAt < 0) return
    setHinted((h) => new Set(h).add(hintAt))
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      check()
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      hint()
    }
  }

  const onChange = (value: string) => {
    if (startedAt === null) setStartedAt(timestamp())
    // A pasted or wrapped line break would otherwise reach the box as text.
    setInput(value.replace(/\n/g, ' '))
  }

  const restart = () => {
    resetSentence()
    setIndex(0)
    setOutcomes({})
    setRound((r) => r + 1)
    setStartedAt(null)
    setFinishedAt(null)
  }

  const nextPassage = () => {
    const progress = getState().translateProgress
    const next = pickPassage(PASSAGES_BY_LEVEL[passage.level], (id) => Boolean(progress[id]), passage.id)
    navigate(next && next.id !== passage.id ? `/p/${next.id}` : '/')
  }

  const status = () => {
    if (revealed)
      return (
        <span className="text-red">
          Đáp án: <span className="font-mono">{answer}</span>
        </span>
      )
    if (checked && failed) {
      const missing = tiles.length - checked.length
      return (
        <span className="text-red">
          Chưa đúng: các từ gạch đỏ sai
          {missing > 0 ? `, còn thiếu ${missing} từ` : missing < 0 ? `, thừa ${-missing} từ` : ''}. Sửa rồi nhấn Enter.
        </span>
      )
    }
    if (unknown.length > 0)
      return (
        <span className="text-red">
          Không có trong ô từ: <span className="font-mono">{unknown.join(', ')}</span>
        </span>
      )
    return (
      <span className="text-pencil">
        Đã dùng {used.size}/{tiles.length} từ · không cần gõ dấu câu
        {hinted.size > 0 && ` · đã gợi ý ${hinted.size}`}
      </span>
    )
  }

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <BackLink to="/">Bộ {passage.level}</BackLink>
          <ModeToggle />
        </div>
        {!done && (
          <span className="font-mono text-base text-pencil">
            {index}/{sentences.length} câu
          </span>
        )}
      </div>

      {done ? (
        <Paper label="Kết quả dịch ngược" className="fade-up">
          <TranslateResult
            passage={passage}
            outcomes={outcomes}
            seconds={((finishedAt ?? 0) - (startedAt ?? finishedAt ?? 0)) / 1000}
            onRetry={restart}
            onCopy={() => setPracticeMode('copy')}
            onNext={nextPassage}
          />
        </Paper>
      ) : (
        <Paper label="Dịch ngược" progress={(100 * index) / sentences.length}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h1 className="m-0 text-[26px] font-semibold tracking-tight sm:text-[28px]">{passage.titleVi}</h1>
            <span className="text-base text-pencil italic">Xếp các từ thành câu tiếng Anh</span>
          </div>

          <div className="flex flex-col gap-6">
            <section aria-label="Câu tiếng Việt" className="rounded-[4px] border border-note-border bg-note px-5 pt-3 pb-4 sm:px-6">
              <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">
                Câu {index + 1}/{sentences.length}
              </span>
              <p lang="vi" className="m-0 mt-1 text-[22px] leading-snug font-medium sm:text-[26px]">
                {sentence.vi}
              </p>
            </section>

            <section aria-label="Các từ của câu tiếng Anh" className="flex flex-col gap-2">
              <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">Các từ</span>
              <ul className="m-0 flex list-none flex-wrap gap-2 rounded-[4px] border-2 border-dashed border-rule bg-paper p-3 sm:p-4">
                {bank.map((tile) => {
                  const isUsed = used.has(tile.index) || revealed
                  return (
                    <li
                      key={tile.index}
                      className={`relative rounded-[3px] border px-2.5 py-1 font-mono text-lg sm:text-xl ${
                        isUsed
                          ? 'border-line bg-transparent text-untyped line-through'
                          : `border-rule text-ink shadow-[0_1px_0_var(--color-rule)] ${tile.vocab ? 'bg-marker-soft' : 'bg-card'}`
                      }`}
                    >
                      {tile.text}
                      {hinted.has(tile.index) && (
                        <span
                          aria-label={`từ thứ ${tile.index + 1}`}
                          className="absolute -top-2.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 font-mono text-xs font-bold text-paper no-underline"
                        >
                          {tile.index + 1}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section aria-label="Bản dịch của bạn" className="flex flex-col gap-2">
              <label htmlFor="translate-input" className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">
                Câu tiếng Anh của bạn
              </label>
              {index > 0 && (
                <p lang="en" className="m-0 font-mono text-[17px] leading-relaxed text-pencil">
                  {sentences
                    .slice(0, index)
                    .map((s) => stripMarkup(s.en))
                    .join(' ')}
                </p>
              )}
              <textarea
                id="translate-input"
                ref={inputRef}
                value={revealed ? answer : input}
                readOnly={revealed}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Gõ câu tiếng Anh…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={`min-h-[88px] w-full resize-none rounded-[4px] border-2 bg-card px-4 py-3 font-mono text-xl leading-relaxed text-ink [field-sizing:content] placeholder:text-untyped focus-visible:outline-none sm:text-[22px] ${
                  failed ? 'border-red' : 'border-rule focus:border-ink'
                }`}
              />
              {checked && (
                <p lang="en" aria-label="Lần kiểm tra trước" className={`m-0 font-mono text-lg leading-relaxed ${failed ? '' : 'opacity-60'}`}>
                  {checked.map((w, i) => (
                    <span key={i}>
                      <span className={w === tiles[i]?.norm ? 'text-ink' : 'text-red line-through decoration-2'}>{w}</span>{' '}
                    </span>
                  ))}
                </p>
              )}
              <p className="m-0 min-h-6 text-[15px]">{status()}</p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {!revealed ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={hint}
                      disabled={hintAt < 0}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border border-rule bg-card px-4 font-serif text-base text-ink hover:border-ink disabled:cursor-default disabled:opacity-40"
                    >
                      Gợi ý thứ tự <span className="font-mono text-xs text-pencil">Tab</span>
                    </button>
                    <button
                      type="button"
                      onClick={showAnswer}
                      className="min-h-11 cursor-pointer border-0 bg-transparent px-0 font-serif text-base text-pencil underline underline-offset-4 hover:text-ink"
                    >
                      Xem đáp án
                    </button>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={check}
                    disabled={typed.length === 0}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border-0 bg-ink px-5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft disabled:cursor-default disabled:opacity-40"
                  >
                    Kiểm tra <span className="font-mono text-xs opacity-70">Enter</span>
                  </button>
                </>
              ) : (
                <button
                  ref={continueRef}
                  type="button"
                  onClick={() => advance()}
                  className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border-0 bg-ink px-5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
                >
                  Tiếp tục <span className="font-mono text-xs opacity-70">Enter</span>
                </button>
              )}
            </div>
          </div>
        </Paper>
      )}
    </Page>
  )
}

function TranslateResult({
  passage,
  outcomes,
  seconds,
  onRetry,
  onCopy,
  onNext,
}: {
  passage: Passage
  outcomes: Record<number, Outcome>
  seconds: number
  onRetry: () => void
  onCopy: () => void
  onNext: () => void
}) {
  const total = passage.sentences.length
  const list = Object.values(outcomes)
  const clean = list.filter(isClean).length
  const fixed = list.filter((o) => o.status !== 'revealed' && !isClean(o)).length
  const revealed = list.filter((o) => o.status === 'revealed').length
  // Sentences worth another look: anything not right on the first try without hints.
  const review = passage.sentences.flatMap((s, i) => {
    const o = outcomes[i]
    return o && !isClean(o) ? [{ en: stripMarkup(s.en), vi: s.vi, status: o.status }] : []
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-base text-pencil italic">Xong “{passage.titleVi}”</span>
        <dl className="m-0 mt-2 flex flex-wrap gap-x-10 gap-y-3 font-mono">
          {[
            ['điểm', `${Math.round((100 * clean) / total)}%`, true],
            ['đúng ngay', `${clean}/${total}`, false],
            ['phải sửa / gợi ý', String(fixed), false],
            ['xem đáp án', String(revealed), false],
            ['thời gian', formatTime(seconds), false],
          ].map(([label, value, big]) => (
            <div key={label as string} className="flex flex-col">
              <dt className="text-sm text-pencil">{label}</dt>
              <dd className={`m-0 leading-none font-bold ${big ? 'text-[44px] text-ink' : 'text-[26px] text-ink-soft'}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {review.length > 0 && (
        <section aria-labelledby="tr-review" className="flex flex-col gap-2">
          <h2 id="tr-review" className="m-0 text-xl font-semibold">
            Các câu nên xem lại
          </h2>
          <ul className="m-0 list-none p-0">
            {review.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-b border-line py-2.5">
                <span lang="vi" className="text-[17px] text-pencil">
                  {r.vi}
                </span>
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span lang="en" className="min-w-0 font-mono text-[17px] text-ink">
                    {r.en}
                  </span>
                  <span className={`font-mono text-xs ${r.status === 'revealed' ? 'text-red' : 'text-pencil'}`}>
                    {r.status === 'revealed' ? 'xem đáp án' : 'phải sửa / gợi ý'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 cursor-pointer border-0 bg-transparent px-0 font-serif text-[17px] text-pencil underline underline-offset-4 hover:text-ink"
          >
            Dịch lại
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="min-h-11 cursor-pointer border-0 bg-transparent px-0 font-serif text-[17px] text-pencil underline underline-offset-4 hover:text-ink"
          >
            Gõ chép đoạn này
          </button>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-[3px] border-0 bg-ink px-5.5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
        >
          Đoạn ngẫu nhiên khác →
        </button>
      </div>
    </div>
  )
}
