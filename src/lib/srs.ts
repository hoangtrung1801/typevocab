/**
 * Spaced repetition scheduling, a simplified SM-2 (the algorithm behind
 * Anki). Each saved word has a card; grading a review sets when it is due
 * next. Pure functions, so the schedule can be unit tested.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy']

export type SrsCard = {
  /** Interval multiplier; starts at 2.5, never below 1.3. */
  ease: number
  /** Days until the next review after a successful one; 0 while relearning. */
  interval: number
  /** Successful reviews in a row. */
  reps: number
  /** Times a learned word was forgotten. */
  lapses: number
  /** ISO time the card is due. */
  due: string
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
/** A forgotten word comes back after this, usually later in the same session. */
export const RELEARN_DELAY = 10 * MINUTE
const MIN_EASE = 1.3

export function newCard(addedAt: string): SrsCard {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: addedAt }
}

export function isDue(card: SrsCard, now: number): boolean {
  return new Date(card.due).getTime() <= now
}

/** Days until the next review for each grade, keeping hard <= good < easy. */
function nextIntervals(card: SrsCard): Record<Exclude<Grade, 'again'>, number> {
  const { reps, interval, ease } = card
  const good = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease))
  const hard = reps === 0 ? 1 : Math.min(good, Math.max(interval + 1, Math.round(interval * 1.2)))
  const easy = reps === 0 ? 4 : Math.max(good + 1, Math.round(interval * ease * 1.3))
  return { hard, good, easy }
}

export function schedule(card: SrsCard, grade: Grade, now: number): SrsCard {
  if (grade === 'again') {
    const learned = card.reps > 0
    return {
      ease: learned ? Math.max(MIN_EASE, card.ease - 0.2) : card.ease,
      interval: 0,
      reps: 0,
      lapses: card.lapses + (learned ? 1 : 0),
      due: new Date(now + RELEARN_DELAY).toISOString(),
    }
  }
  const days = nextIntervals(card)[grade]
  const ease =
    grade === 'hard' ? Math.max(MIN_EASE, card.ease - 0.15) : grade === 'easy' ? card.ease + 0.15 : card.ease
  return {
    ease: Math.round(ease * 100) / 100,
    interval: days,
    reps: card.reps + 1,
    lapses: card.lapses,
    due: new Date(now + days * DAY).toISOString(),
  }
}

/** Time until the card would be due after each grade, for the grade buttons. */
export function previewGrades(card: SrsCard, now: number): Record<Grade, number> {
  return Object.fromEntries(
    GRADES.map((g) => [g, new Date(schedule(card, g, now).due).getTime() - now]),
  ) as Record<Grade, number>
}

/** "10 phút", "5 giờ", "3 ngày", "2 tháng" */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE))
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ngày`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} tháng`
  return `${Math.round(days / 365)} năm`
}
