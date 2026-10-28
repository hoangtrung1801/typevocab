import { useState } from 'react'
import type { Passage } from '../data/types'
import { formatTime } from '../lib/passage'
import { reviewKey, updateReview, useStore, type ReviewWord } from '../lib/store'
import type { Stats } from '../lib/typing'

type Props = {
  passage: Passage
  vocabOrder: string[]
  /** Vocab keys of target words that got at least one wrong keystroke. */
  mistyped: string[]
  stats: Stats
  onRetry: () => void
  onSaved: () => void
  hasNext: boolean
}

/** After a passage: the result, then tick the words to keep in the review list. */
export default function WordPicker({ passage, vocabOrder, mistyped, stats, onRetry, onSaved, hasNext }: Props) {
  const review = useStore((s) => s.review)
  const items: (Omit<ReviewWord, 'addedAt'> & { mistyped: boolean })[] = vocabOrder.map((key) => ({
    ...passage.vocab[key],
    level: passage.level,
    passageId: passage.id,
    mistyped: mistyped.includes(key),
  }))
  // Start with words already in the review list plus the ones typed wrong.
  const [selected, setSelected] = useState(
    () => new Set(items.filter((w) => w.mistyped || review[reviewKey(w.level, w.word)]).map((w) => reviewKey(w.level, w.word))),
  )

  const allSelected = selected.size === items.length
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = () => {
    updateReview(
      items.map(({ word, pos, ipa, vi, level, passageId }) => ({ word, pos, ipa, vi, level, passageId })),
      selected,
    )
    onSaved()
  }

  const next = hasNext ? 'sang đoạn tiếp →' : 'về danh sách →'
  const saveLabel = selected.size ? `Lưu ${selected.size} từ & ${next}` : next.charAt(0).toUpperCase() + next.slice(1)

  return (
    <>
      <span className="text-base text-pencil italic">Xong “{passage.title}”</span>
      <dl className="mt-3 mb-7 flex flex-wrap gap-x-10 gap-y-3 font-mono">
        {[
          ['wpm', String(stats.wpm), true],
          ['acc', `${stats.acc}%`, true],
          ['raw', String(stats.raw), false],
          ['time', formatTime(stats.seconds), false],
        ].map(([label, value, big]) => (
          <div key={label as string} className="flex flex-col">
            <dt className="text-sm text-pencil">{label}</dt>
            <dd className={`m-0 leading-none font-bold text-ink ${big ? 'text-[44px]' : 'text-[26px] text-ink-soft'}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <h1 className="m-0 mb-5 text-[26px] font-semibold tracking-tight sm:text-[30px]">Chọn những từ bạn muốn ôn lại</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2">
        <span className="font-mono text-[15px] text-pencil">{items.length} từ trong đoạn</span>
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((w) => reviewKey(w.level, w.word))))}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-serif text-base text-pencil underline underline-offset-4"
        >
          {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
      </div>

      <ul className="m-0 list-none p-0">
        {items.map((w) => {
          const key = reviewKey(w.level, w.word)
          const checked = selected.has(key)
          return (
            <li key={key} className="border-b border-line">
              <label className={`-mx-3 flex cursor-pointer flex-wrap items-center gap-x-4.5 gap-y-1 px-3 py-3.5 ${checked ? 'bg-marker-soft' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(key)}
                  className="m-0 size-[22px] shrink-0 cursor-pointer accent-red"
                />
                <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-2.5">
                    <span className="text-[22px] font-semibold">{w.word}</span>
                    <span className="text-[15px] text-pencil italic">{w.pos}</span>
                    {w.mistyped && <span className="font-mono text-[13px] text-red">gõ sai</span>}
                  </span>
                  {w.ipa && <span className="font-mono text-sm text-pencil">{w.ipa}</span>}
                </span>
                <span lang="vi" className="min-w-0 flex-[1_1_240px] pl-10 text-[19px] sm:pl-0">
                  {w.vi}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-0 font-serif text-[17px] text-pencil underline underline-offset-4"
        >
          Gõ lại đoạn này
        </button>
        <button
          type="button"
          onClick={save}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-[3px] border-0 bg-ink px-5.5 font-serif text-[17px] font-medium text-paper hover:bg-ink-soft"
        >
          {saveLabel}
        </button>
      </div>
    </>
  )
}
