import { setPracticeMode, useStore, type PracticeMode } from '../lib/store'

const MODES: { mode: PracticeMode; label: string }[] = [
  { mode: 'copy', label: 'Gõ chép' },
  { mode: 'translate', label: 'Dịch ngược' },
]

/** Switches between copying the English text and translating from Vietnamese. */
export default function ModeToggle() {
  const current = useStore((s) => s.practiceMode)
  return (
    <div role="group" aria-label="Chế độ luyện" className="inline-flex rounded-[4px] border border-rule bg-card p-0.5">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={mode === current}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPracticeMode(mode)}
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
