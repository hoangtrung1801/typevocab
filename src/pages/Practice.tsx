import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import ModeToggle from '../components/ModeToggle'
import Page from '../components/Page'
import Paper from '../components/Paper'
import TranslateSession from '../components/TranslateSession'
import TypingBoard from '../components/TypingBoard'
import WordPicker from '../components/WordPicker'
import { getPassage, pickPassage, PASSAGES_BY_LEVEL } from '../data'
import type { Passage } from '../data/types'
import { formatTime, parsePassage, revealedChunkWords } from '../lib/passage'
import { play } from '../lib/sound'
import { getState, saveResult, setLastLevel, setShowTranslation, setSoundOn, useStore } from '../lib/store'
import { backspace, initTyping, stats, typeChar, type TypingState } from '../lib/typing'

export default function Practice() {
  const { id = '' } = useParams()
  const mode = useStore((s) => s.practiceMode)
  const passage = getPassage(id)
  if (!passage) return <Navigate to="/" replace />
  return mode === 'translate' ? (
    <TranslateSession key={passage.id} passage={passage} />
  ) : (
    <PracticeSession key={passage.id} passage={passage} />
  )
}

function PracticeSession({ passage }: { passage: Passage }) {
  const navigate = useNavigate()
  const parsed = useMemo(() => parsePassage(passage.sentences), [passage])
  const words = useMemo(() => parsed.text.split(' '), [parsed])
  const showTranslation = useStore((s) => s.showTranslation)
  const soundOn = useStore((s) => s.soundOn)

  const [typing, setTyping] = useState(() => initTyping(words))
  const [now, setNow] = useState(() => Date.now())
  const [focused, setFocused] = useState(false)
  const [picking, setPicking] = useState(false)
  const savedAt = useRef<number | null>(null)

  const done = typing.finishedAt !== null
  const levelPassages = PASSAGES_BY_LEVEL[passage.level]
  const hasNext = levelPassages.length > 1

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

  // Keystrokes are discrete events, so React renders between them; keeping the
  // latest state in a ref lets each handler see what the keystroke changed and
  // pick a sound without side effects inside a state updater.
  const typingRef = useRef(typing)
  const soundRef = useRef(soundOn)
  useEffect(() => {
    soundRef.current = soundOn
  }, [soundOn])

  const commit = useCallback((next: TypingState) => {
    typingRef.current = next
    setTyping(next)
  }, [])

  const onChar = useCallback(
    (ch: string) => {
      const prev = typingRef.current
      const next = typeChar(prev, ch, Date.now())
      if (next === prev) return
      commit(next)
      if (!soundRef.current) return
      if (ch === ' ') play('space')
      else play(next.correctKeystrokes > prev.correctKeystrokes ? 'key' : 'error')
      if (next.finishedAt !== null) play('bell')
    },
    [commit],
  )
  const onBackspace = useCallback(
    (whole: boolean) => {
      const prev = typingRef.current
      const next = backspace(prev, whole)
      if (next === prev) return
      commit(next)
      if (soundRef.current) play('backspace')
    },
    [commit],
  )
  const restart = useCallback(() => {
    commit(initTyping(words))
    setPicking(false)
  }, [words, commit])

  const live = stats(typing, typing.finishedAt ?? now)
  const wordsDone = typing.current + (done ? 1 : 0)
  const sentence = parsed.chars[parsed.words[typing.current].chars[0]].sentence

  // Reveal the translation phrase by phrase, word by word, as the English
  // sentence is typed.
  const currentWord = parsed.words[typing.current]
  const caret = currentWord.chars[0] + Math.min(typing.typed[typing.current].length, currentWord.chars.length)
  const { enChunks, viChunks, vi } = passage.sentences[sentence]
  const viWords = vi.split(' ')
  const shownWords = done
    ? viWords.length
    : revealedChunkWords(
        enChunks.map((c) => c.length),
        viChunks.map((c) => c.split(' ').length),
        caret - parsed.sentenceStarts[sentence],
      )
  const mistyped = useMemo(
    () => [...new Set(typing.errorWords.map((i) => parsed.words[i].vocab).filter((v): v is string => v !== null))],
    [typing.errorWords, parsed],
  )

  return (
    <Page wide>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <BackLink to="/">Bộ {passage.level}</BackLink>
          <ModeToggle />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-base text-pencil">
            {wordsDone}/{words.length} từ · {formatTime(live.seconds)}
          </span>
          <button
            type="button"
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
            title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSoundOn(!soundOn)}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent text-pencil hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              {soundOn ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}
            </svg>
          </button>
        </div>
      </div>

      {picking ? (
        <Paper label="Kết quả và chọn từ cần ôn" className="fade-up">
          <WordPicker
            passage={passage}
            vocabOrder={parsed.vocabOrder}
            mistyped={mistyped}
            stats={live}
            hasNext={hasNext}
            onRetry={restart}
            onSaved={() => {
              const progress = getState().progress
              const next = hasNext ? pickPassage(levelPassages, (id) => Boolean(progress[id]), passage.id) : undefined
              navigate(next ? `/p/${next.id}` : '/')
            }}
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

            {done ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-rule pt-4">
                <p className="fade-up m-0 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-pencil">
                  <span>
                    <span className="text-[32px] font-bold text-ink">{live.wpm}</span> wpm
                  </span>
                  <span>
                    <span className="text-[32px] font-bold text-ink">{live.acc}%</span> acc
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="fade-up inline-flex min-h-11 cursor-pointer items-center rounded-[3px] border-0 bg-ink px-5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
                >
                  Chọn từ cần ôn →
                </button>
              </div>
            ) : (
              <section aria-label="Bản dịch câu đang gõ" className="mt-6 rounded-[4px] border border-note-border bg-note px-5 pt-3 pb-4 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[13px] font-bold tracking-wider text-red uppercase">
                    Câu {sentence + 1}/{passage.sentences.length}
                  </span>
                  <button
                    type="button"
                    aria-pressed={showTranslation}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowTranslation(!showTranslation)}
                    className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-serif text-[15px] text-pencil underline underline-offset-4 hover:text-ink"
                  >
                    {showTranslation ? 'Ẩn bản dịch' : 'Hiện bản dịch'}
                  </button>
                </div>
                {showTranslation ? (
                  <p key={sentence} lang="vi" className="m-0 text-[21px] leading-snug font-medium text-ink sm:text-2xl">
                    <span className="sr-only">{passage.sentences[sentence].vi}</span>
                    <span aria-hidden="true">
                      {viWords.map((w, i) => (
                        <span key={i}>
                          <span className={`vi-word ${i < shownWords ? 'vi-word-shown' : ''}`}>{w}</span>{' '}
                        </span>
                      ))}
                    </span>
                  </p>
                ) : (
                  <p className="m-0 text-lg text-pencil italic">Bản dịch đang ẩn: tự đoán nghĩa câu này trước nhé.</p>
                )}
              </section>
            )}
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
