export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_NAMES: Record<Level, string> = {
  A1: 'Sơ cấp',
  A2: 'Sơ trung cấp',
  B1: 'Trung cấp',
  B2: 'Trung cao cấp',
  C1: 'Cao cấp',
}

export type VocabEntry = {
  /** Dictionary form, e.g. "cage" even when the text says "cages". */
  word: string
  pos: string
  ipa: string
  vi: string
}

/** One sentence as written in the JSON files. */
export type RawSentence = {
  /**
   * English text. Target words are marked as [surface|key] or [key]. " / "
   * splits the sentence into phrases that pair, in order, with the phrases of
   * `vi`.
   */
  en: string
  vi: string
}

export type Sentence = {
  /** English text with markup, without phrase separators. */
  en: string
  vi: string
  /** Plain English phrases; joined with spaces they make the sentence. */
  enChunks: string[]
  /** Vietnamese phrases, one per English phrase. */
  viChunks: string[]
}

export type RawPassage = {
  title: string
  titleVi: string
  sentences: RawSentence[]
  vocab: Record<string, VocabEntry>
}

export type Passage = Omit<RawPassage, 'sentences'> & {
  sentences: Sentence[]
  id: string
  level: Level
  /** 1-based position within its level. */
  number: number
}
