import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DRILLS_BY_LEVEL, getDefinition } from '../data'
import type { Drill } from '../data/types'
import { nextPath } from '../lib/navigation'
import { markupKeys, parsePassage, stripMarkup } from '../lib/passage'
import { isCorrectOrder, matchTiles, nextWordHint, properWords, sentenceTiles, shuffleTiles, typedWords } from '../lib/scramble'
import { play } from '../lib/sound'
import { canSpeak, speak } from '../lib/speech'
import { reviewKey, saveTranslateResult, setLastLevel, setPracticeMode, updateReview, useStore } from '../lib/store'
import BackLink from './BackLink'
import ModeToggle from './ModeToggle'
import Page from './Page'
import Paper from './Paper'

type Outcome = { status: 'first' | 'fixed' | 'revealed'; hints: number }

/** Called from event handlers only; kept outside the component for clarity. */
const timestamp = () => Date.now()

const isClean = (o: Outcome) => o.status === 'first' && o.hints === 0
const scoreOf = (o: Outcome) => (o.status === 'revealed' ? 0 : isClean(o) ? 100 : 50)

/**
 * Reverse translation of one short sentence: its English words are shown
 * shuffled under the Vietnamese sentence and the learner types the English
 * sentence back in order, checking with Enter. A hint numbers the tile of the
 * next word. When done, the sentence and its target word are shown.
 */
export default function TranslateSession({ drill }: { drill: Drill }) {
  const navigate = useNavigate()
  const soundOn = useStore((s) => s.soundOn)
  const translateProgress = useStore((s) => s.translateProgress)
  const [input, setInput] = useState('')
  const [hinted, setHinted] = useState<Set<number>>(() => new Set())
  /** The typed words at the last failed check, shown against the answer. */
  const [checked, setChecked] = useState<string[] | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  /** Bumped on retry so the bank is shuffled differently. */
  const [round, setRound] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const answer = stripMarkup(drill.en)
  const tiles = sentenceTiles(drill.en, properWords([drill.en]))
  const bank = shuffleTiles(tiles, `${drill.id}:${round}`)
  const typed = typedWords(input)
  const { used, unknown } = matchTiles(tiles, typed)
  const hintAt = nextWordHint(tiles, typed, hinted)
  // The check result counts while the words checked are still the ones typed.
  const failed = checked !== null && checked.join(' ') === typed.join(' ')
  const levelDrills = DRILLS_BY_LEVEL[drill.level]
  const levelDone = levelDrills.filter((d) => translateProgress[d.id]).length

  useEffect(() => {
    setLastLevel(drill.level)
    setPracticeMode('translate')
  }, [drill.level])

  useEffect(() => {
    if (outcome) nextRef.current?.focus()
    else inputRef.current?.focus()
  }, [outcome, round])

  const finish = (result: Outcome) => {
    setOutcome(result)
    if (soundOn && canSpeak()) speak(answer)
    const end = timestamp()
    saveTranslateResult(drill.id, {
      score: scoreOf(result),
      seconds: Math.round((end - (startedAt ?? end)) / 1000),
      completedAt: new Date(end).toISOString(),
    })
  }

  const check = () => {
    if (outcome || typed.length === 0) return
    if (isCorrectOrder(tiles, typed)) {
      if (soundOn) play('bell')
      finish({ status: attempts === 0 ? 'first' : 'fixed', hints: hinted.size })
    } else {
      setAttempts((a) => a + 1)
      setChecked(typed)
      if (soundOn) play('error')
    }
  }

  const hint = () => {
    if (outcome || hintAt < 0) return
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
    // A pasted line break would otherwise reach the box as text.
    setInput(value.replace(/\n/g, ' '))
  }

  const retry = () => {
    setInput('')
    setHinted(new Set())
    setChecked(null)
    setAttempts(0)
    setOutcome(null)
    setStartedAt(null)
    setRound((r) => r + 1)
  }

  const status = () => {
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
          <BackLink to="/">Bộ {drill.level}</BackLink>
          <ModeToggle level={drill.level} />
        </div>
        <span className="font-mono text-base text-pencil">
          {levelDone}/{levelDrills.length} câu
        </span>
      </div>

      <Paper label="Dịch ngược" progress={outcome ? 100 : (100 * used.size) / tiles.length}>
        <div className="flex flex-col gap-6">
          <section aria-label="Câu tiếng Việt" className="rounded-[4px] border border-note-border bg-note px-5 pt-3 pb-4 sm:px-6">
            <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">Dịch sang tiếng Anh</span>
            <p lang="vi" className="m-0 mt-1 text-[24px] leading-snug font-medium sm:text-[28px]">
              {drill.vi}
            </p>
          </section>

          {outcome ? (
            <Done drill={drill} answer={answer} outcome={outcome} attempts={attempts} />
          ) : (
            <>
              <section aria-label="Các từ của câu tiếng Anh" className="flex flex-col gap-2">
                <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">Các từ</span>
                <ul className="m-0 flex list-none flex-wrap gap-2 rounded-[4px] border-2 border-dashed border-rule bg-paper p-3 sm:p-4">
                  {bank.map((tile) => (
                    <li
                      key={tile.index}
                      className={`relative rounded-[3px] border px-2.5 py-1 font-mono text-lg sm:text-xl ${
                        used.has(tile.index)
                          ? 'border-line bg-transparent text-untyped line-through'
                          : `border-rule text-ink shadow-[0_1px_0_var(--color-rule)] ${tile.vocab ? 'bg-marker-soft' : 'bg-card'}`
                      }`}
                    >
                      {tile.text}
                      {hinted.has(tile.index) && (
                        <span
                          aria-label={`từ thứ ${tile.index + 1}`}
                          className="absolute -top-2.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 font-mono text-xs font-bold text-paper"
                        >
                          {tile.index + 1}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-2">
                <label htmlFor="translate-input" className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">
                  Câu tiếng Anh của bạn
                </label>
                <textarea
                  id="translate-input"
                  ref={inputRef}
                  value={input}
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
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {outcome ? (
              <>
                <button
                  type="button"
                  onClick={retry}
                  className="min-h-11 cursor-pointer border-0 bg-transparent px-0 font-serif text-base text-pencil underline underline-offset-4 hover:text-ink"
                >
                  Làm lại câu này
                </button>
                <button
                  ref={nextRef}
                  type="button"
                  onClick={() => navigate(nextPath('translate', drill.level, drill.id))}
                  className="ml-auto inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[3px] border-0 bg-ink px-5.5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
                >
                  Câu tiếp theo → <span className="font-mono text-xs opacity-70">Enter</span>
                </button>
              </>
            ) : (
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
                    onClick={() => finish({ status: 'revealed', hints: hinted.size })}
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
            )}
          </div>
        </div>
      </Paper>
    </Page>
  )
}

/** The answer with its target word highlighted, and the word's card with a button to save it for review. */
function Done({ drill, answer, outcome, attempts }: { drill: Drill; answer: string; outcome: Outcome; attempts: number }) {
  const review = useStore((s) => s.review)
  const parsed = parsePassage([drill])
  const words = markupKeys(drill.en).flatMap((k) => (drill.vocab[k] ? [drill.vocab[k]] : []))

  const verdict =
    outcome.status === 'revealed'
      ? { text: 'Đáp án', className: 'text-red' }
      : isClean(outcome)
        ? { text: 'Chính xác ngay lần đầu!', className: 'text-ink' }
        : {
            text: `Đúng rồi${attempts > 0 ? ` · sửa ${attempts} lần` : ''}${outcome.hints > 0 ? ` · ${outcome.hints} gợi ý` : ''}`,
            className: 'text-ink-soft',
          }

  return (
    <section aria-label="Kết quả" className="fade-up flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className={`font-mono text-[13px] font-bold tracking-wider uppercase ${verdict.className}`}>{verdict.text}</span>
        <p lang="en" className="m-0 flex flex-wrap items-baseline gap-x-3 font-mono text-[24px] leading-snug text-ink sm:text-[28px]">
          <span>
            {parsed.chars.map((c, i) => (
              <span key={i} className={c.vocab ? 'mark-full font-bold' : undefined}>
                {c.ch}
              </span>
            ))}
          </span>
          {canSpeak() && (
            <button
              type="button"
              onClick={() => speak(answer)}
              className="min-h-10 cursor-pointer border-0 bg-transparent px-1 font-serif text-base text-pencil underline underline-offset-4 hover:text-ink"
            >
              nghe lại
            </button>
          )}
        </p>
      </div>

      {words.map((w) => {
        const key = reviewKey(drill.level, w.word)
        const saved = Boolean(review[key])
        return (
          <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-rule bg-card px-5 py-3.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-2.5">
                <span className="text-[22px] font-semibold">{w.word}</span>
                <span className="text-[15px] text-pencil italic">{w.pos}</span>
                {w.ipa && <span className="font-mono text-sm text-pencil">{w.ipa}</span>}
              </span>
              <span lang="vi" className="text-[17px] text-ink-soft">
                {w.vi}
              </span>
              {getDefinition(drill.level, w.word) && (
                <span lang="en" className="text-[15px] text-pencil">
                  {getDefinition(drill.level, w.word)}
                </span>
              )}
            </span>
            <button
              type="button"
              aria-pressed={saved}
              // Keep focus on "next" so Enter still moves on after saving.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                updateReview(
                  [{ word: w.word, pos: w.pos, ipa: w.ipa, vi: w.vi, level: drill.level, passageId: drill.id }],
                  saved ? new Set() : new Set([key]),
                )
              }
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-[3px] border px-4 font-serif text-base ${
                saved ? 'border-ink bg-ink text-paper' : 'border-rule bg-paper text-ink hover:border-ink'
              }`}
            >
              {saved ? '✓ Đã lưu để ôn' : 'Lưu từ để ôn'}
            </button>
          </div>
        )
      })}
    </section>
  )
}
