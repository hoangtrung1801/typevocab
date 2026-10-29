import { Link, useNavigate } from 'react-router-dom'
import ModeToggle from '../components/ModeToggle'
import Page from '../components/Page'
import Paper from '../components/Paper'
import { PASSAGES_BY_LEVEL, pickPassage } from '../data'
import { LEVEL_NAMES, LEVELS, type Level } from '../data/types'
import { isDue } from '../lib/srs'
import { cardOf, setLastLevel, useStore } from '../lib/store'
import { useNow } from '../lib/useNow'

export default function Home() {
  const navigate = useNavigate()
  const lastLevel = useStore((s) => s.lastLevel)
  const mode = useStore((s) => s.practiceMode)
  const copyProgress = useStore((s) => s.progress)
  const translateProgress = useStore((s) => s.translateProgress)
  // Each mode tracks its own finished passages.
  const progress: Record<string, unknown> = mode === 'translate' ? translateProgress : copyProgress
  const review = useStore((s) => s.review)
  const now = useNow()
  const dueCount = Object.values(review).filter((w) => isDue(cardOf(w), now)).length

  // Picking a set opens a random passage from it, preferring ones not typed yet.
  const start = (level: Level) => {
    const passage = pickPassage(PASSAGES_BY_LEVEL[level], (id) => Boolean(progress[id]))
    if (!passage) return
    setLastLevel(level)
    navigate(`/p/${passage.id}`)
  }

  return (
    <Page>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[30px] font-semibold italic tracking-tight">TypeVocab</h1>
        <Link to="/review" className="inline-flex min-h-11 items-center text-base text-pencil underline underline-offset-4">
          {dueCount > 0 ? `Ôn tập · ${dueCount} từ đến hạn` : 'Từ cần ôn'}
        </Link>
      </header>
      <p className="m-0 -mt-2 text-base text-pencil">Gõ tiếng Anh, học từ vựng ngay trong đoạn văn.</p>

      <Paper label="Chọn bộ từ vựng" className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[26px] font-semibold">Chọn bộ từ vựng</h2>
          <ModeToggle />
        </div>
        <p className="m-0 mt-1 mb-6 text-base text-pencil">
          {mode === 'translate'
            ? 'Mỗi lần chọn, bạn sẽ dịch một đoạn văn ngẫu nhiên từ tiếng Việt sang tiếng Anh, từng cụm một.'
            : 'Mỗi lần chọn, bạn sẽ gõ chép một đoạn văn ngẫu nhiên trong bộ đó.'}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LEVELS.map((level) => {
            const passages = PASSAGES_BY_LEVEL[level]
            const done = passages.filter((p) => progress[p.id]).length
            const last = level === lastLevel
            return (
              <button
                key={level}
                type="button"
                onClick={() => start(level)}
                disabled={passages.length === 0}
                className={`flex min-h-32 cursor-pointer flex-col gap-2 rounded-[4px] border-2 bg-card p-4 text-left font-serif text-ink hover:border-ink disabled:cursor-default disabled:opacity-50 ${
                  last ? 'border-red' : 'border-rule'
                }`}
              >
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="font-mono text-[32px] leading-none font-bold">{level}</span>
                  {last && <span className="font-mono text-xs text-red">lần trước</span>}
                </span>
                <span className="text-lg font-medium">{LEVEL_NAMES[level]}</span>
                <span className="mt-auto flex flex-col gap-1.5">
                  <span className="text-sm text-pencil">
                    {done}/{passages.length} {mode === 'translate' ? 'đoạn đã dịch' : 'đoạn đã gõ'}
                  </span>
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-red"
                      style={{ width: `${passages.length ? (100 * done) / passages.length : 0}%` }}
                    />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </Paper>
    </Page>
  )
}
