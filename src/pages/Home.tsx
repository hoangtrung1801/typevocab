import { Link } from 'react-router-dom'
import Page from '../components/Page'
import Paper from '../components/Paper'
import { PASSAGES_BY_LEVEL } from '../data'
import { TOPIC_TITLE } from '../data/topics'
import { LEVEL_NAMES, LEVELS } from '../data/types'
import { setLastLevel, useStore } from '../lib/store'

export default function Home() {
  const level = useStore((s) => s.lastLevel)
  const progress = useStore((s) => s.progress)
  const review = useStore((s) => s.review)
  const reviewCount = Object.keys(review).length

  const passages = PASSAGES_BY_LEVEL[level]
  const doneCount = passages.filter((p) => progress[p.id]).length
  const nextId = passages.find((p) => !progress[p.id])?.id

  return (
    <Page>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[30px] font-semibold italic tracking-tight">TypeVocab</h1>
        <Link to="/review" className="inline-flex min-h-11 items-center text-base text-pencil underline underline-offset-4">
          Từ cần ôn · {reviewCount}
        </Link>
      </header>
      <p className="m-0 -mt-2 text-base text-pencil">Gõ tiếng Anh, học từ vựng ngay trong đoạn văn.</p>

      <nav aria-label="Trình độ" className="mt-4 flex flex-wrap gap-1.5 border-b border-rule">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={l === level}
            onClick={() => setLastLevel(l)}
            className={`-mb-px min-h-12 min-w-16 cursor-pointer border-0 border-b-2 bg-transparent px-4 font-mono text-xl font-bold ${
              l === level ? 'border-red text-ink' : 'border-transparent text-faint hover:text-ink'
            }`}
          >
            {l}
          </button>
        ))}
      </nav>

      <Paper label={`Đoạn văn trình độ ${level}`} className="mt-3">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-[26px] font-semibold">
            {LEVEL_NAMES[level]} · {level}
          </h2>
          <span className="text-[15px] text-pencil">
            {doneCount}/{passages.length} đoạn đã gõ
          </span>
        </div>
        <ol className="m-0 list-none p-0">
          {passages.map((p, i) => {
            const done = Boolean(progress[p.id])
            // A heading whenever the vocabulary topic changes.
            const newTopic = i === 0 || passages[i - 1].topic !== p.topic
            return (
              <li key={p.id} className="border-b border-line">
                {newTopic && (
                  <h3 className={`m-0 font-mono text-[13px] font-bold tracking-wider text-red uppercase ${i === 0 ? 'pt-1' : 'pt-7'} pb-1`}>
                    {TOPIC_TITLE[p.topic] ?? p.topic}
                  </h3>
                )}
                <Link to={`/p/${p.id}`} className="flex min-h-11 items-center gap-4 py-3.5 text-ink no-underline sm:gap-5">
                  <span className="w-9 shrink-0 font-mono text-[15px] text-faint">{String(p.number).padStart(2, '0')}</span>
                  <span className="flex min-w-0 flex-auto flex-wrap items-baseline gap-x-3">
                    <span className="text-xl font-medium">{p.title}</span>
                    <span className="text-base text-pencil italic">{p.titleVi}</span>
                  </span>
                  {done && (
                    <span className="inline-flex shrink-0 items-center gap-2 font-mono text-sm text-pencil">
                      {progress[p.id].wpm} wpm
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Đã gõ xong" className="text-ink">
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    </span>
                  )}
                  {p.id === nextId && <span className="shrink-0 text-[15px] whitespace-nowrap text-red italic">gõ tiếp →</span>}
                </Link>
              </li>
            )
          })}
        </ol>
      </Paper>
    </Page>
  )
}
