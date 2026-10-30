import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Page from '../components/Page'
import Paper from '../components/Paper'
import { getDefinition, getSource } from '../data'
import { LEVELS } from '../data/types'
import { formatDuration, isDue } from '../lib/srs'
import { cardOf, removeReview, reviewKey, useStore } from '../lib/store'
import { useNow } from '../lib/useNow'

export default function Review() {
  const review = useStore((s) => s.review)
  const now = useNow()
  // Soonest review first; ties by level.
  const words = Object.values(review).sort(
    (a, b) => cardOf(a).due.localeCompare(cardOf(b).due) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level),
  )
  const dueCount = words.filter((w) => isDue(cardOf(w), now)).length
  const nextDue = words.length ? new Date(cardOf(words[0]).due).getTime() - now : 0

  return (
    <Page>
      <div>
        <BackLink to="/">Danh sách đoạn</BackLink>
      </div>
      <Paper label="Từ cần ôn">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="m-0 text-[28px] font-semibold tracking-tight">Từ cần ôn</h1>
          <span className="font-mono text-[15px] text-pencil">{words.length} từ</span>
        </div>

        {words.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-note-border bg-note px-5 py-4">
            <p className="m-0 text-lg">
              {dueCount > 0 ? (
                <>
                  <span className="font-semibold">{dueCount} từ</span> đến hạn ôn
                </>
              ) : (
                <span className="text-pencil">Không có từ nào đến hạn. Lần ôn tiếp theo: sau {formatDuration(nextDue)}.</span>
              )}
            </p>
            {dueCount > 0 && (
              <Link
                to="/review/session"
                className="inline-flex min-h-11 items-center rounded-[3px] bg-ink px-5 text-[17px] font-medium text-paper no-underline hover:bg-ink-soft hover:text-paper"
              >
                Ôn ngay →
              </Link>
            )}
          </div>
        )}

        {words.length === 0 ? (
          <p className="m-0 py-6 text-lg text-pencil italic">
            Chưa có từ nào. Gõ xong một đoạn văn rồi chọn những từ bạn muốn ôn lại.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {words.map((w) => {
              const key = reviewKey(w.level, w.word)
              const source = getSource(w.passageId)
              const card = cardOf(w)
              const due = isDue(card, now)
              return (
                <li key={key} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line py-3.5">
                  <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-2.5">
                      <span className="text-[22px] font-semibold">{w.word}</span>
                      <span className="text-[15px] text-pencil italic">{w.pos}</span>
                      <span className="font-mono text-sm font-bold text-red">{w.level}</span>
                    </span>
                    {w.ipa && <span className="font-mono text-sm text-pencil">{w.ipa}</span>}
                  </span>
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                    <span lang="vi" className="text-[19px]">
                      {w.vi}
                    </span>
                    {getDefinition(w.level, w.word) && (
                      <span lang="en" className="text-[15px] text-ink-soft">
                        {getDefinition(w.level, w.word)}
                      </span>
                    )}
                    {source && (
                      <Link to={source.path} className="text-sm text-pencil italic">
                        trong “{source.title}”
                      </Link>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className={`font-mono text-sm ${due ? 'font-bold text-red' : 'text-pencil'}`}>
                      {!w.srs ? 'mới' : due ? 'đến hạn' : `sau ${formatDuration(new Date(card.due).getTime() - now)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeReview(key)}
                      className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-serif text-base text-pencil underline underline-offset-4"
                    >
                      Đã nhớ
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Paper>
    </Page>
  )
}
