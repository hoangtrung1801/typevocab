import { useState } from 'react'
import type { Passage } from '../data/types'
import { reviewKey, updateReview, useStore, type ReviewWord } from '../lib/store'

type Props = {
  passage: Passage
  vocabOrder: string[]
  onRetry: () => void
  onSaved: () => void
  hasNext: boolean
}

/** After a passage: tick the words to keep in the review list. */
export default function WordPicker({ passage, vocabOrder, onRetry, onSaved, hasNext }: Props) {
  const review = useStore((s) => s.review)
  const items: Omit<ReviewWord, 'addedAt'>[] = vocabOrder.map((key) => ({
    ...passage.vocab[key],
    level: passage.level,
    passageId: passage.id,
  }))
  const [selected, setSelected] = useState(
    () => new Set(items.map((w) => reviewKey(w.level, w.word)).filter((k) => review[k])),
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
    updateReview(items, selected)
    onSaved()
  }

  const next = hasNext ? 'sang đoạn tiếp →' : 'về danh sách →'
  const saveLabel = selected.size ? `Lưu ${selected.size} từ & ${next}` : next.charAt(0).toUpperCase() + next.slice(1)

  return (
    <>
      <div className="mb-5 flex flex-col gap-1.5">
        <span className="text-base text-pencil italic">Xong “{passage.title}”</span>
        <h1 className="m-0 text-[26px] font-semibold tracking-tight sm:text-[30px]">Chọn những từ bạn muốn ôn lại</h1>
      </div>

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
                  </span>
                  <span className="font-mono text-sm text-pencil">{w.ipa}</span>
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
