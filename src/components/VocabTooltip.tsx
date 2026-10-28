import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Level, VocabEntry } from '../data/types'

type Props = {
  entry: VocabEntry
  level: Level
  /** Element whose horizontal bounds the card must stay inside. */
  boundsRef: RefObject<HTMLElement | null>
}

/** Index-card style meaning shown above a target word. */
export default function VocabTooltip({ entry, level, boundsRef }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    const bounds = boundsRef.current
    if (!el || !bounds) return
    const r = el.getBoundingClientRect()
    const b = bounds.getBoundingClientRect()
    let dx = 0
    if (r.right > b.right) dx = b.right - r.right
    if (r.left + dx < b.left) dx = b.left - r.left
    setShift(dx)
  }, [boundsRef])

  return (
    <span
      ref={ref}
      role="tooltip"
      style={{ transform: `translateX(${shift}px)` }}
      className="pointer-events-none absolute bottom-[calc(100%-4px)] -left-2.5 z-10 flex w-[280px] flex-col gap-1 rounded-[3px] border border-rule border-t-[3px] border-t-red bg-card px-4 pt-3 pb-3.5 font-serif leading-snug whitespace-normal text-ink shadow-card"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[22px] font-semibold">{entry.word}</span>
        <span className="font-mono text-sm font-bold text-red">{level}</span>
      </span>
      <span className="font-mono text-sm text-pencil">
        {entry.ipa} · {entry.pos}
      </span>
      <span lang="vi" className="text-lg">
        {entry.vi}
      </span>
    </span>
  )
}
