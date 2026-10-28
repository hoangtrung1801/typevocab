import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Page from '../components/Page'
import Paper from '../components/Paper'
import TypingText from '../components/TypingText'
import WordPicker from '../components/WordPicker'
import { getPassage, nextPassage, PASSAGES_BY_LEVEL } from '../data'
import type { Passage } from '../data/types'
import { formatTime, parsePassage, wordsPerMinute } from '../lib/passage'
import { saveResult, setLastLevel, setShowTranslation, useStore } from '../lib/store'

export default function Practice() {
  const { id = '' } = useParams()
  const passage = getPassage(id)
  if (!passage) return <Navigate to="/" replace />
  return <PracticeSession key={passage.id} passage={passage} />
}

const INPUT_ID = 'typing-input'

function PracticeSession({ passage }: { passage: Passage }) {
  const navigate = useNavigate()
  const parsed = useMemo(() => parsePassage(passage.sentences), [passage])
  const showTranslation = useStore((s) => s.showTranslation)

  const [typed, setTyped] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [focused, setFocused] = useState(false)
  const [picking, setPicking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { text, chars } = parsed
  const done = typed.length >= text.length
  const next = nextPassage(passage)

  useEffect(() => setLastLevel(passage.level), [passage.level])

  useEffect(() => {
    if (!picking) inputRef.current?.focus()
  }, [picking])

  useEffect(() => {
    if (!startedAt || finishedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt, finishedAt])

  const seconds = startedAt ? Math.max(0, ((finishedAt ?? now) - startedAt) / 1000) : 0
  const wpm = wordsPerMinute(typed.length, seconds)
  const sentence = chars[Math.min(typed.length, text.length - 1)].sentence

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (done) return
    const value = e.target.value.slice(0, text.length)
    const t = Date.now()
    const start = startedAt ?? t
    if (!startedAt) setStartedAt(t)
    setTyped(value)
    if (value.length === text.length) {
      setFinishedAt(t)
      setNow(t)
      const secs = (t - start) / 1000
      saveResult(passage.id, { wpm: wordsPerMinute(value.length, secs), seconds: Math.round(secs), completedAt: new Date(t).toISOString() })
    }
  }

  const restart = () => {
    setTyped('')
    setStartedAt(null)
    setFinishedAt(null)
    setPicking(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      restart()
    } else if (e.key === 'Enter' && done) {
      e.preventDefault()
      setPicking(true)
    }
  }

  const total = PASSAGES_BY_LEVEL[passage.level].length

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink to="/">
          {passage.level} · Đoạn {passage.number}/{total}
        </BackLink>
        <span className="font-mono text-base text-pencil" aria-live="off">
          {wpm} wpm · {formatTime(seconds)}
        </span>
      </div>

      {picking ? (
        <Paper label="Chọn từ cần ôn">
          <WordPicker
            passage={passage}
            vocabOrder={parsed.vocabOrder}
            hasNext={Boolean(next)}
            onRetry={restart}
            onSaved={() => navigate(next ? `/p/${next.id}` : '/')}
          />
        </Paper>
      ) : (
        <>
          <Paper label="Trang giấy để gõ" progress={(100 * typed.length) / text.length}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h1 className="m-0 text-[26px] font-semibold tracking-tight sm:text-[28px]">{passage.title}</h1>
              <span className="text-base text-pencil italic">{passage.titleVi}</span>
            </div>

            <input
              ref={inputRef}
              id={INPUT_ID}
              type="text"
              value={typed}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onPaste={(e) => e.preventDefault()}
              maxLength={text.length}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Ô nhập: gõ lại đoạn văn tiếng Anh"
              className="absolute top-24 left-12 size-px border-0 p-0 text-base opacity-0 sm:left-23"
            />

            <TypingText passage={passage} parsed={parsed} typed={typed} focused={focused} inputId={INPUT_ID} />

            <div className="mt-6 flex min-h-14 flex-wrap items-start justify-between gap-4 border-t border-dashed border-rule pt-4">
              {showTranslation ? (
                <p lang="vi" className="m-0 min-w-0 flex-[1_1_400px] text-[19px] leading-normal text-ink-soft italic sm:text-[21px]">
                  <span className="mr-2.5 font-mono text-sm text-red not-italic">
                    {sentence + 1}/{passage.sentences.length}
                  </span>
                  {passage.sentences[sentence].vi}
                </p>
              ) : (
                <p className="m-0 flex-[1_1_400px] text-lg text-pencil italic">
                  Bản dịch đang ẩn: tự đoán nghĩa câu {sentence + 1}/{passage.sentences.length} trước nhé.
                </p>
              )}
              {done ? (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-[3px] border-0 bg-ink px-5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
                >
                  Xong, chọn từ cần ôn →
                </button>
              ) : (
                <button
                  type="button"
                  aria-pressed={showTranslation}
                  onClick={() => {
                    setShowTranslation(!showTranslation)
                    inputRef.current?.focus()
                  }}
                  className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-serif text-base text-pencil underline underline-offset-4"
                >
                  {showTranslation ? 'Ẩn bản dịch' : 'Hiện bản dịch'}
                </button>
              )}
            </div>
          </Paper>

          <p className="m-0 min-h-6 text-center text-[15px] text-pencil italic">
            {done
              ? 'Enter để chọn từ cần ôn · Esc để gõ lại'
              : focused
                ? 'Esc để gõ lại từ đầu'
                : 'Bấm vào trang giấy để gõ · rê chuột vào từ được tô để xem nghĩa'}
          </p>
        </>
      )}
    </Page>
  )
}
