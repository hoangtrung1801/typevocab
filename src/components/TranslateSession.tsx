import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickPassage, PASSAGES_BY_LEVEL } from '../data'
import type { Passage } from '../data/types'
import { formatTime, markupKeys } from '../lib/passage'
import { answerLetters, isCorrectLetters, nextWordHintIndex, wrongPositions } from '../lib/review'
import { play } from '../lib/sound'
import { canSpeak, speak } from '../lib/speech'
import { getState, saveTranslateResult, setLastLevel, setPracticeMode, useStore } from '../lib/store'
import BackLink from './BackLink'
import LetterBoxes from './LetterBoxes'
import ModeToggle from './ModeToggle'
import Page from './Page'
import Paper from './Paper'

type Outcome = { status: 'first' | 'fixed' | 'revealed'; hints: number }

/** Called from event handlers only; kept outside the component for clarity. */
const timestamp = () => Date.now()

/**
 * Reverse translation: the Vietnamese sentence is shown phrase by phrase and
 * the learner types the matching English phrase into letter boxes, checking
 * each phrase with Enter. Hints reveal letters of the current word.
 */
export default function TranslateSession({ passage }: { passage: Passage }) {
  const navigate = useNavigate()
  const soundOn = useStore((s) => s.soundOn)
  const [pos, setPos] = useState({ s: 0, c: 0 })
  const [input, setInput] = useState('')
  const [hinted, setHinted] = useState<Set<number>>(() => new Set())
  const [wrong, setWrong] = useState<Set<number> | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  const sentences = passage.sentences
  const sentence = sentences[pos.s]
  const en = sentence.enChunks[pos.c]
  const letters = answerLetters(en)
  const hintAt = nextWordHintIndex(en, input, hinted)
  const totalChunks = sentences.reduce((n, s) => n + s.enChunks.length, 0)
  const chunksDone = sentences.slice(0, pos.s).reduce((n, s) => n + s.enChunks.length, 0) + pos.c
  const done = finishedAt !== null
  const vocabHints = markupKeys(sentence.en).map((k) => passage.vocab[k]?.word ?? k)

  useEffect(() => setLastLevel(passage.level), [passage.level])

  useEffect(() => {
    if (done) return
    if (revealed) continueRef.current?.focus()
    else inputRef.current?.focus()
  }, [pos, revealed, done])

  const chunkKey = `${pos.s}-${pos.c}`
  const record = (outcome: Outcome) => setOutcomes((o) => ({ ...o, [chunkKey]: outcome }))

  const resetChunk = () => {
    setInput('')
    setHinted(new Set())
    setWrong(null)
    setRevealed(false)
    setAttempts(0)
  }

  /** `outcome` is the result of the phrase just finished, when not yet in state. */
  const advance = (outcome?: Outcome) => {
    const lastChunk = pos.c === sentence.enChunks.length - 1
    if (lastChunk && soundOn && canSpeak()) speak(sentence.enChunks.join(' '))
    resetChunk()
    if (!lastChunk) return setPos({ s: pos.s, c: pos.c + 1 })
    if (pos.s < sentences.length - 1) return setPos({ s: pos.s + 1, c: 0 })

    const end = timestamp()
    setFinishedAt(end)
    if (soundOn) play('bell')
    const all = outcome ? { ...outcomes, [chunkKey]: outcome } : outcomes
    const first = Object.values(all).filter((o) => o.status === 'first' && o.hints === 0).length
    saveTranslateResult(passage.id, {
      score: Math.round((100 * first) / totalChunks),
      seconds: Math.round((end - (startedAt ?? end)) / 1000),
      completedAt: new Date(end).toISOString(),
    })
  }

  const check = () => {
    if (revealed) return advance()
    if (!input) return
    if (isCorrectLetters(input, letters)) {
      const outcome: Outcome = { status: attempts === 0 ? 'first' : 'fixed', hints: hinted.size }
      record(outcome)
      if (soundOn) play('space')
      advance(outcome)
    } else {
      setAttempts((a) => a + 1)
      setWrong(wrongPositions(input, letters))
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

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
    setInput(value)
    setWrong(null)
  }

  const restart = () => {
    resetChunk()
    setPos({ s: 0, c: 0 })
    setOutcomes({})
    setStartedAt(null)
    setFinishedAt(null)
  }

  const nextPassage = () => {
    const progress = getState().translateProgress
    const next = pickPassage(PASSAGES_BY_LEVEL[passage.level], (id) => Boolean(progress[id]), passage.id)
    navigate(next && next.id !== passage.id ? `/p/${next.id}` : '/')
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
            {chunksDone}/{totalChunks} cụm
          </span>
        )}
      </div>

      {done ? (
        <Paper label="Kết quả dịch ngược" className="fade-up">
          <TranslateResult
            passage={passage}
            outcomes={outcomes}
            totalChunks={totalChunks}
            seconds={((finishedAt ?? 0) - (startedAt ?? finishedAt ?? 0)) / 1000}
            onRetry={restart}
            onCopy={() => setPracticeMode('copy')}
            onNext={nextPassage}
          />
        </Paper>
      ) : (
        <Paper label="Dịch ngược" progress={(100 * chunksDone) / totalChunks}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h1 className="m-0 text-[26px] font-semibold tracking-tight sm:text-[28px]">{passage.titleVi}</h1>
            <span className="text-base text-pencil italic">Dịch sang tiếng Anh</span>
          </div>

          <div className="flex flex-col gap-6">
            <section aria-label="Câu tiếng Việt" className="rounded-[4px] border border-note-border bg-note px-5 pt-3 pb-4 sm:px-6">
              <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">
                Câu {pos.s + 1}/{sentences.length}
              </span>
              <p lang="vi" className="m-0 mt-1 text-[21px] leading-snug sm:text-2xl">
                {sentence.viChunks.map((chunk, i) => (
                  <span key={i}>
                    <span
                      className={
                        i < pos.c ? 'text-ink' : i === pos.c ? 'mark-full font-semibold text-ink' : 'text-pencil'
                      }
                    >
                      {chunk}
                    </span>{' '}
                  </span>
                ))}
              </p>
              {vocabHints.length > 0 && (
                <p className="m-0 mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] text-pencil">
                  Từ vựng trong câu:
                  {vocabHints.map((w) => (
                    <span key={w} className="rounded-[3px] border border-note-border bg-card px-2 font-mono text-sm text-ink">
                      {w}
                    </span>
                  ))}
                </p>
              )}
            </section>

            <section aria-label="Bản dịch của bạn" className="flex flex-col gap-3">
              <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">Bản dịch của bạn</span>
              {(pos.s > 0 || pos.c > 0) && (
                <p lang="en" className="m-0 font-mono text-[17px] leading-relaxed">
                  {sentences.slice(0, pos.s).map((s, i) => (
                    <span key={i} className="text-pencil">
                      {s.enChunks.join(' ')}{' '}
                    </span>
                  ))}
                  <span className="text-ink">{sentence.enChunks.slice(0, pos.c).join(' ')}</span>
                </p>
              )}
              <LetterBoxes
                answer={en}
                letters={letters}
                typed={input}
                hinted={hinted}
                revealed={revealed}
                wrong={wrong ?? undefined}
                size="md"
                onChange={onChange}
                onKeyDown={onKeyDown}
                inputRef={inputRef}
              />
              <p className="m-0 min-h-6 text-[15px]">
                {revealed ? (
                  <span className="text-red">
                    Đáp án: <span className="font-mono">{en}</span>
                  </span>
                ) : wrong ? (
                  <span className="text-red">Chưa đúng: sửa các ô viền đỏ rồi nhấn Enter.</span>
                ) : (
                  <span className="text-pencil">
                    {letters.length} ký tự · dấu câu đã điền sẵn
                    {hinted.size > 0 && ` · đã gợi ý ${hinted.size}`}
                  </span>
                )}
              </p>
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
                      Gợi ý một chữ <span className="font-mono text-xs text-pencil">Tab</span>
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
                    disabled={!input}
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
  totalChunks,
  seconds,
  onRetry,
  onCopy,
  onNext,
}: {
  passage: Passage
  outcomes: Record<string, Outcome>
  totalChunks: number
  seconds: number
  onRetry: () => void
  onCopy: () => void
  onNext: () => void
}) {
  const list = Object.values(outcomes)
  const first = list.filter((o) => o.status === 'first' && o.hints === 0).length
  const fixed = list.filter((o) => o.status !== 'revealed' && !(o.status === 'first' && o.hints === 0)).length
  const revealed = list.filter((o) => o.status === 'revealed').length
  // Phrases worth another look: anything not right on the first try without hints.
  const review = passage.sentences.flatMap((s, si) =>
    s.enChunks.flatMap((en, ci) => {
      const o = outcomes[`${si}-${ci}`]
      return o && !(o.status === 'first' && o.hints === 0) ? [{ en, vi: s.viChunks[ci], status: o.status }] : []
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-base text-pencil italic">Xong “{passage.titleVi}”</span>
        <dl className="m-0 mt-2 flex flex-wrap gap-x-10 gap-y-3 font-mono">
          {[
            ['điểm', `${Math.round((100 * first) / totalChunks)}%`, true],
            ['đúng ngay', `${first}/${totalChunks}`, false],
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
            Các cụm nên xem lại
          </h2>
          <ul className="m-0 list-none p-0">
            {review.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-line py-2.5">
                <span lang="vi" className="min-w-0 flex-[1_1_220px] text-[17px] text-pencil">
                  {r.vi}
                </span>
                <span lang="en" className="min-w-0 flex-[1_1_220px] font-mono text-[17px] text-ink">
                  {r.en}
                </span>
                <span className={`font-mono text-xs ${r.status === 'revealed' ? 'text-red' : 'text-pencil'}`}>
                  {r.status === 'revealed' ? 'xem đáp án' : 'phải sửa / gợi ý'}
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
