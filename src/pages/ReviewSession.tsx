import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Page from '../components/Page'
import Paper from '../components/Paper'
import { getPassage } from '../data'
import { blankHint, clozeFor, isCorrectAnswer } from '../lib/review'
import { play } from '../lib/sound'
import { formatDuration, GRADES, isDue, previewGrades, type Grade } from '../lib/srs'
import { cardOf, getState, gradeReview, useStore, type ReviewWord } from '../lib/store'

/** Most cards in one session, so a long backlog stays manageable. */
const SESSION_SIZE = 30

const GRADE_LABEL: Record<Grade, string> = { again: 'Quên', hard: 'Khó', good: 'Được', easy: 'Dễ' }

function dueQueue(review: Record<string, ReviewWord>, now: number): string[] {
  return Object.entries(review)
    .filter(([, w]) => isDue(cardOf(w), now))
    .sort(([, a], [, b]) => cardOf(a).due.localeCompare(cardOf(b).due))
    .slice(0, SESSION_SIZE)
    .map(([key]) => key)
}

/** Time until the earliest upcoming review, or null when nothing is saved. */
function nextReviewIn(review: Record<string, ReviewWord>, now: number): number | null {
  const dues = Object.values(review).map((w) => new Date(cardOf(w).due).getTime())
  return dues.length ? Math.max(0, Math.min(...dues) - now) : null
}

export default function ReviewSession() {
  const review = useStore((s) => s.review)
  const soundOn = useStore((s) => s.soundOn)
  // The queue is fixed when the session starts; forgotten words are appended.
  const [queue, setQueue] = useState(() => dueQueue(getState().review, Date.now()))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [revealed, setRevealed] = useState<null | { correct: boolean; at: number }>(null)
  const [counts, setCounts] = useState<Record<Grade, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const defaultButton = useRef<HTMLButtonElement>(null)

  const key = queue[index]
  const word = key ? review[key] : undefined
  const done = !word
  const passage = word ? getPassage(word.passageId) : undefined
  const cloze = word && passage ? clozeFor(passage.sentences, word.word.toLowerCase()) : null
  const answer = cloze?.answer ?? word?.word ?? ''
  const suggested: Grade = revealed?.correct ? 'good' : 'again'

  useEffect(() => {
    if (revealed) defaultButton.current?.focus()
    else inputRef.current?.focus()
  }, [revealed, index])

  const reveal = (correct: boolean) => {
    setRevealed({ correct, at: Date.now() })
    if (soundOn) play(correct ? 'bell' : 'error')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!word || revealed || !input.trim()) return
    reveal(isCorrectAnswer(input, answer, word.word))
  }

  const grade = (g: Grade) => {
    if (!key || !revealed) return
    const now = Date.now()
    gradeReview(key, g, now)
    setCounts((c) => ({ ...c, [g]: c[g] + 1 }))
    if (g === 'again') setQueue((q) => [...q, key])
    setRevealed(null)
    setInput('')
    if (index + 1 >= queue.length && g !== 'again') setFinishedAt(now)
    setIndex((i) => i + 1)
  }

  // Number keys 1-4 grade the card once the answer is shown.
  useEffect(() => {
    if (!revealed) return
    const onKey = (e: KeyboardEvent) => {
      const g = GRADES[Number(e.key) - 1]
      if (g && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        grade(g)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const reviewed = counts.again + counts.hard + counts.good + counts.easy
  const previews = word && revealed ? previewGrades(cardOf(word), revealed.at) : null

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink to="/review">Từ cần ôn</BackLink>
        {!done && (
          <span className="font-mono text-base text-pencil">
            {index + 1}/{queue.length}
          </span>
        )}
      </div>

      {done ? (
        <Paper label="Kết thúc buổi ôn" className="fade-up">
          <SessionEnd reviewed={reviewed} counts={counts} review={review} now={finishedAt} />
        </Paper>
      ) : (
        <Paper label="Thẻ ôn từ vựng" progress={(100 * index) / queue.length}>
          <div key={`${key}-${index}`} className="fade-up flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">
                Gõ từ tiếng Anh · {word.level}
              </span>
              <p lang="vi" className="m-0 text-[28px] leading-tight font-semibold">
                {word.vi}
              </p>
              <span className="text-base text-pencil italic">{word.pos}</span>
            </div>

            {cloze && (
              <div className="flex flex-col gap-1.5 border-t border-dashed border-rule pt-4">
                <p className="m-0 font-mono text-[19px] leading-relaxed text-ink-soft sm:text-[21px]">
                  {cloze.before}
                  <span className={`px-0.5 ${revealed ? 'mark-full text-ink' : 'mark-soft tracking-widest'}`}>
                    {revealed ? cloze.answer : blankHint(cloze.answer)}
                  </span>
                  {cloze.after}
                </p>
                <p lang="vi" className="m-0 text-[17px] text-pencil italic">
                  {cloze.vi}
                </p>
              </div>
            )}

            {!revealed ? (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  aria-label="Gõ từ tiếng Anh"
                  placeholder="gõ từ rồi nhấn Enter"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full border-0 border-b-2 border-rule bg-transparent py-2 font-mono text-[26px] text-ink outline-none placeholder:text-untyped focus:border-ink focus-visible:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => reveal(false)}
                    className="min-h-11 cursor-pointer border-0 bg-transparent px-0 font-serif text-base text-pencil underline underline-offset-4 hover:text-ink"
                  >
                    Không nhớ, xem đáp án
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-[3px] border-0 bg-ink px-5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft disabled:cursor-default disabled:opacity-40"
                  >
                    Kiểm tra
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className={`font-mono text-[15px] font-bold ${revealed.correct ? 'text-ink' : 'text-red'}`}>
                    {revealed.correct ? '✓ Đúng' : input.trim() ? `✗ Bạn gõ “${input.trim()}”` : '✗ Chưa nhớ'}
                  </span>
                  <span className="text-[26px] font-semibold">{word.word}</span>
                  {word.ipa && <span className="font-mono text-[15px] text-pencil">{word.ipa}</span>}
                </div>
                <div>
                  <p className="m-0 mb-2 text-[15px] text-pencil">Bạn nhớ từ này thế nào? (phím 1–4)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {GRADES.map((g, i) => (
                      <button
                        key={g}
                        ref={g === suggested ? defaultButton : undefined}
                        type="button"
                        onClick={() => grade(g)}
                        className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[3px] border px-2 py-2 font-serif ${
                          g === suggested ? 'border-ink bg-ink text-paper' : 'border-rule bg-card text-ink hover:border-ink'
                        }`}
                      >
                        <span className="text-[17px] font-medium">
                          {GRADE_LABEL[g]} <span className="font-mono text-xs opacity-70">{i + 1}</span>
                        </span>
                        <span className="font-mono text-xs opacity-80">{previews && formatDuration(previews[g])}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Paper>
      )}
    </Page>
  )
}

function SessionEnd({
  reviewed,
  counts,
  review,
  now,
}: {
  reviewed: number
  counts: Record<Grade, number>
  review: Record<string, ReviewWord>
  now: number | null
}) {
  const [at] = useState(() => now ?? Date.now())
  const next = nextReviewIn(review, at)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 text-[28px] font-semibold tracking-tight">
        {reviewed ? 'Xong buổi ôn!' : 'Chưa có từ nào đến hạn ôn'}
      </h1>
      {reviewed > 0 && (
        <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2 font-mono">
          {GRADES.map((g) => (
            <div key={g} className="flex flex-col">
              <dt className="text-sm text-pencil">{GRADE_LABEL[g]}</dt>
              <dd className="m-0 text-[26px] font-bold text-ink">{counts[g]}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="m-0 text-lg text-pencil">
        {next === null
          ? 'Gõ xong một đoạn văn rồi chọn những từ muốn ôn để bắt đầu.'
          : next === 0
            ? 'Vẫn còn từ đến hạn. Bắt đầu buổi ôn mới để ôn tiếp.'
            : `Lần ôn tiếp theo: sau ${formatDuration(next)}.`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Link to="/review" className="text-[17px] text-pencil underline underline-offset-4">
          Danh sách từ cần ôn
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-[3px] bg-ink px-5 text-[17px] font-medium text-paper no-underline hover:bg-ink-soft hover:text-paper"
        >
          Luyện gõ tiếp
        </Link>
      </div>
    </div>
  )
}
