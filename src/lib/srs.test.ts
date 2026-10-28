import { describe, expect, it } from 'vitest'
import { formatDuration, isDue, newCard, previewGrades, RELEARN_DELAY, schedule } from './srs'

const DAY = 24 * 60 * 60 * 1000
const t0 = Date.UTC(2026, 0, 1)
const daysUntil = (due: string, now: number) => Math.round((new Date(due).getTime() - now) / DAY)

describe('srs', () => {
  it('makes a new card due as soon as it is saved', () => {
    const card = newCard(new Date(t0).toISOString())
    expect(isDue(card, t0)).toBe(true)
    expect(isDue(card, t0 - 1)).toBe(false)
  })

  it('grows the interval 1 -> 3 -> ~ease x on good answers', () => {
    let card = newCard(new Date(t0).toISOString())
    const seen: number[] = []
    let now = t0
    for (let i = 0; i < 4; i++) {
      card = schedule(card, 'good', now)
      seen.push(card.interval)
      now = new Date(card.due).getTime()
    }
    expect(seen).toEqual([1, 3, 8, 20])
    expect(card.ease).toBe(2.5)
  })

  it('keeps hard <= good < easy at every step', () => {
    let card = newCard(new Date(t0).toISOString())
    for (let i = 0; i < 6; i++) {
      const p = previewGrades(card, t0)
      expect(p.again).toBe(RELEARN_DELAY)
      expect(p.hard).toBeLessThanOrEqual(p.good)
      expect(p.good).toBeLessThan(p.easy)
      card = schedule(card, 'good', t0)
    }
  })

  it('sends a forgotten word back in 10 minutes and resets its progress', () => {
    let card = newCard(new Date(t0).toISOString())
    card = schedule(card, 'good', t0)
    card = schedule(card, 'good', t0)
    const lapsed = schedule(card, 'again', t0)
    expect(new Date(lapsed.due).getTime() - t0).toBe(RELEARN_DELAY)
    expect(lapsed).toMatchObject({ reps: 0, interval: 0, lapses: 1, ease: 2.3 })
    // Then it starts over at one day.
    expect(daysUntil(schedule(lapsed, 'good', t0).due, t0)).toBe(1)
  })

  it('does not count failing a brand-new word as a lapse', () => {
    const card = schedule(newCard(new Date(t0).toISOString()), 'again', t0)
    expect(card).toMatchObject({ lapses: 0, ease: 2.5 })
  })

  it('adjusts ease on hard and easy, never below 1.3', () => {
    let card = newCard(new Date(t0).toISOString())
    for (let i = 0; i < 20; i++) card = schedule(card, 'hard', t0)
    expect(card.ease).toBe(1.3)
    expect(schedule(newCard(new Date(t0).toISOString()), 'easy', t0)).toMatchObject({ interval: 4, ease: 2.65 })
  })

  it('formats durations in Vietnamese', () => {
    expect(formatDuration(RELEARN_DELAY)).toBe('10 phút')
    expect(formatDuration(5 * 60 * 60 * 1000)).toBe('5 giờ')
    expect(formatDuration(3 * DAY)).toBe('3 ngày')
    expect(formatDuration(65 * DAY)).toBe('2 tháng')
  })
})
