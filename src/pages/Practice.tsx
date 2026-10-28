import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Page from '../components/Page'
import Paper from '../components/Paper'
import TypingBoard from '../components/TypingBoard'
import WordPicker from '../components/WordPicker'
import { getPassage, nextPassage, PASSAGES_BY_LEVEL } from '../data'
import type { Passage } from '../data/types'
import { formatTime, parsePassage } from '../lib/passage'
import { saveResult, setLastLevel, setShowTranslation, useStore } from '../lib/store'
import { backspace, initTyping, stats, typeChar } from '../lib/typing'

export default function Practice() {
  const { id = '' } = useParams()
  const passage = getPassage(id)
  if (!passage) return <Navigate to="/" replace />
  return <PracticeSession key={passage.id} passage={passage} />
}

function PracticeSession({ passage }: { passage: Passage }) {
  const navigate = useNavigate()
  const parsed = useMemo(() => parsePassage(passage.sentences), [passage])
  const words = useMemo(() => parsed.text.split(' '), [parsed])
  const showTranslation = useStore((s) => s.showTranslation)

  const [typing, setTyping] = useState(() => initTyping(words))
  const [now, setNow] = useState(() => Date.now())
  const [focused, setFocused] = useState(false)
  const [picking, setPicking] = useState(false)
  const savedAt = useRef<number | null>(null)

  const done = typing.finishedAt !== null
  const next = nextPassage(passage)
  const total = PASSAGES_BY_LEVEL[passage.level].length

  useEffect(() => setLastLevel(passage.level), [passage.level])

  useEffect(() => {
    if (typing.startedAt === null || done) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [typing.startedAt, done])

  // Save each finished attempt once.
  useEffect(() => {
    if (typing.finishedAt === null || savedAt.current === typing.finishedAt) return
    savedAt.current = typing.finishedAt
    const s = stats(typing, typing.finishedAt)
    saveResult(passage.id, {
      wpm: s.wpm,
      acc: s.acc,
      seconds: Math.round(s.seconds),
      completedAt: new Date(typing.finishedAt).toISOString(),
    })
  }, [typing, passage.id])

  const onChar = useCallback((ch: string) => {
    const t = Date.now()
    setTyping((s) => typeChar(s, ch, t))
  }, [])
  const onBackspace = useCallback((whole: boolean) => setTyping((s) => backspace(s, whole)), [])
  const restart = useCallback(() => {
    setTyping(initTyping(words))
    setPicking(false)
  }, [words])

  const live = stats(typing, typing.finishedAt ?? now)
  const wordsDone = typing.current + (done ? 1 : 0)
  const sentence = parsed.chars[parsed.words[typing.current].chars[0]].sentence
  const mistyped = useMemo(
    () => [...new Set(typing.errorWords.map((i) => parsed.words[i].vocab).filter((v): v is string => v !== null))],
    [typing.errorWords, parsed],
  )

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink to="/">
          {passage.level} · Đoạn {passage.number}/{total}
        </BackLink>
        <span className="font-mono text-base text-pencil">
          {wordsDone}/{words.length} từ · {formatTime(live.seconds)}
        </span>
      </div>

      {picking ? (
        <Paper label="Kết quả và chọn từ cần ôn" className="fade-up">
          <WordPicker
            passage={passage}
            vocabOrder={parsed.vocabOrder}
            mistyped={mistyped}
            stats={live}
            hasNext={Boolean(next)}
            onRetry={restart}
            onSaved={() => navigate(next ? `/p/${next.id}` : '/')}
          />
        </Paper>
      ) : (
        <>
          <Paper label="Trang giấy để gõ" progress={(100 * wordsDone) / words.length}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h1 className="m-0 text-[26px] font-semibold tracking-tight sm:text-[28px]">{passage.title}</h1>
              <span className="text-base text-pencil italic">{passage.titleVi}</span>
            </div>

            <TypingBoard
              passage={passage}
              parsed={parsed}
              state={typing}
              onChar={onChar}
              onBackspace={onBackspace}
              onRestart={restart}
              onFinishConfirm={() => setPicking(true)}
              onFocusChange={setFocused}
            />

            <div className="mt-6 flex min-h-14 flex-wrap items-start justify-between gap-4 border-t border-dashed border-rule pt-4">
              {done ? (
                <p className="fade-up m-0 flex flex-[1_1_400px] flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-pencil">
                  <span>
                    <span className="text-[32px] font-bold text-ink">{live.wpm}</span> wpm
                  </span>
                  <span>
                    <span className="text-[32px] font-bold text-ink">{live.acc}%</span> acc
                  </span>
                </p>
              ) : showTranslation ? (
                <p key={sentence} lang="vi" className="fade-up m-0 min-w-0 flex-[1_1_400px] text-[19px] leading-normal text-ink-soft italic sm:text-[21px]">
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
                  className="fade-up inline-flex min-h-11 cursor-pointer items-center rounded-[3px] border-0 bg-ink px-5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
                >
                  Chọn từ cần ôn →
                </button>
              ) : (
                <button
                  type="button"
                  aria-pressed={showTranslation}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowTranslation(!showTranslation)}
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
                ? 'Esc hoặc Tab để gõ lại · rê chuột vào từ được tô để xem nghĩa'
                : ''}
          </p>
        </>
      )}
    </Page>
  )
}
