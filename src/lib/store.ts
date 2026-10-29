import { useSyncExternalStore } from 'react'
import type { Level } from '../data/types'
import { newCard, schedule, type Grade, type SrsCard } from './srs'

export type PassageResult = {
  wpm: number
  /** 0–100; missing for results saved before accuracy was tracked. */
  acc?: number
  seconds: number
  completedAt: string
}

export type PracticeMode = 'copy' | 'translate'

export type TranslateResult = {
  /** 100 right on the first try without hints, 50 after fixing or hints, 0 when the answer was shown. */
  score: number
  seconds: number
  completedAt: string
}

export type ReviewWord = {
  word: string
  pos: string
  ipa: string
  vi: string
  level: Level
  /** The passage or reverse translation sentence the word was saved from. */
  passageId: string
  addedAt: string
  /** Spaced repetition state; missing until the word is first reviewed. */
  srs?: SrsCard
}

export type State = {
  progress: Record<string, PassageResult>
  /** Keyed by reviewKey(level, word). */
  review: Record<string, ReviewWord>
  showTranslation: boolean
  soundOn: boolean
  lastLevel: Level
  practiceMode: PracticeMode
  translateProgress: Record<string, TranslateResult>
}

const STORAGE_KEY = 'typevocab:v1'

const DEFAULT_STATE: State = {
  progress: {},
  review: {},
  showTranslation: true,
  soundOn: true,
  lastLevel: 'A1',
  practiceMode: 'copy',
  translateProgress: {},
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    // Private mode or corrupted data: start fresh.
  }
  return DEFAULT_STATE
}

let state: State = load()
const listeners = new Set<() => void>()

export function getState(): State {
  return state
}

export function setState(update: (s: State) => State) {
  state = update(state)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable: keep the in-memory state.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function reviewKey(level: Level, word: string): string {
  return `${level}:${word}`
}

export function saveResult(passageId: string, result: PassageResult) {
  setState((s) => {
    const prev = s.progress[passageId]
    // Keep the best speed but always refresh the completion date.
    const best = prev && prev.wpm > result.wpm ? { ...prev, completedAt: result.completedAt } : result
    return { ...s, progress: { ...s.progress, [passageId]: best } }
  })
}

/** Sets which of `candidates` are in the review list: `selected` are added, the rest removed. */
export function updateReview(candidates: Omit<ReviewWord, 'addedAt'>[], selected: Set<string>) {
  const addedAt = new Date().toISOString()
  setState((s) => {
    const review = { ...s.review }
    for (const w of candidates) {
      const key = reviewKey(w.level, w.word)
      if (selected.has(key)) review[key] = review[key] ?? { ...w, addedAt }
      else delete review[key]
    }
    return { ...s, review }
  })
}

export function removeReview(key: string) {
  setState((s) => {
    const review = { ...s.review }
    delete review[key]
    return { ...s, review }
  })
}

/** The word's review card; a word never reviewed is due from when it was saved. */
export function cardOf(word: ReviewWord): SrsCard {
  return word.srs ?? newCard(word.addedAt)
}

export function gradeReview(key: string, grade: Grade, now: number) {
  setState((s) => {
    const word = s.review[key]
    if (!word) return s
    return { ...s, review: { ...s.review, [key]: { ...word, srs: schedule(cardOf(word), grade, now) } } }
  })
}

export function setShowTranslation(show: boolean) {
  setState((s) => ({ ...s, showTranslation: show }))
}

export function setSoundOn(on: boolean) {
  setState((s) => ({ ...s, soundOn: on }))
}

export function setPracticeMode(mode: PracticeMode) {
  setState((s) => ({ ...s, practiceMode: mode }))
}

export function saveTranslateResult(sentenceId: string, result: TranslateResult) {
  setState((s) => {
    const prev = s.translateProgress[sentenceId]
    // Keep the best score but always refresh the completion date.
    const best = prev && prev.score > result.score ? { ...prev, completedAt: result.completedAt } : result
    return { ...s, translateProgress: { ...s.translateProgress, [sentenceId]: best } }
  })
}

export function setLastLevel(level: Level) {
  setState((s) => ({ ...s, lastLevel: level }))
}
