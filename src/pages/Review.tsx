import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Page from '../components/Page'
import Paper from '../components/Paper'
import { getPassage } from '../data'
import { LEVELS } from '../data/types'
import { removeReview, reviewKey, useStore } from '../lib/store'

export default function Review() {
  const review = useStore((s) => s.review)
  const words = Object.values(review).sort(
    (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || b.addedAt.localeCompare(a.addedAt),
  )

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

        {words.length === 0 ? (
          <p className="m-0 py-6 text-lg text-pencil italic">
            Chưa có từ nào. Gõ xong một đoạn văn rồi chọn những từ bạn muốn ôn lại.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {words.map((w) => {
              const key = reviewKey(w.level, w.word)
              const passage = getPassage(w.passageId)
              return (
                <li key={key} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line py-3.5">
                  <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-2.5">
                      <span className="text-[22px] font-semibold">{w.word}</span>
                      <span className="text-[15px] text-pencil italic">{w.pos}</span>
                      <span className="font-mono text-sm font-bold text-red">{w.level}</span>
                    </span>
                    <span className="font-mono text-sm text-pencil">{w.ipa}</span>
                  </span>
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                    <span lang="vi" className="text-[19px]">
                      {w.vi}
                    </span>
                    {passage && (
                      <Link to={`/p/${passage.id}`} className="text-sm text-pencil italic">
                        trong “{passage.title}”
                      </Link>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReview(key)}
                    className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-serif text-base text-pencil underline underline-offset-4"
                  >
                    Đã nhớ
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Paper>
    </Page>
  )
}
