import { useNavigate } from 'react-router-dom'
import type { Level } from '../data/types'
import { nextPath } from '../lib/navigation'
import { setPracticeMode, useStore, type PracticeMode } from '../lib/store'

const MODES: { mode: PracticeMode; label: string }[] = [
  { mode: 'copy', label: 'Gõ chép' },
  { mode: 'translate', label: 'Dịch ngược' },
]

/**
 * Switches between copying passages and translating sentences. On a practice
 * page (`level` given) switching also opens something to do in the new mode.
 */
export default function ModeToggle({ level }: { level?: Level }) {
  const navigate = useNavigate()
  const current = useStore((s) => s.practiceMode)
  const choose = (mode: PracticeMode) => {
    if (mode === current) return
    setPracticeMode(mode)
    if (level) navigate(nextPath(mode, level))
  }
  return (
    <div role="group" aria-label="Chế độ luyện" className="inline-flex rounded-[4px] border border-rule bg-card p-0.5">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={mode === current}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => choose(mode)}
          className={`min-h-10 cursor-pointer rounded-[3px] border-0 px-3.5 font-serif text-[15px] ${
            mode === current ? 'bg-ink text-paper' : 'bg-transparent text-pencil hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
