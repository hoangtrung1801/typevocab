export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_NAMES: Record<Level, string> = {
  A1: 'Sơ cấp',
  A2: 'Sơ trung cấp',
  B1: 'Trung cấp',
  B2: 'Trung cao cấp',
  C1: 'Cao cấp',
  C2: 'Thành thạo',
}

export type VocabEntry = {
  /** Dictionary form, e.g. "cage" even when the text says "cages". */
  word: string
  pos: string
  /** May be empty: a few words in the vocabulary have no transcription. */
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
  /** Stable id such as "b1-u012-2" (level, vocabulary unit, part). */
  id: string
  unit: number
  /** Topic key, see topics.ts. */
  topic: string
  title: string
  titleVi: string
  sentences: RawSentence[]
  vocab: Record<string, VocabEntry>
}

export type Passage = Omit<RawPassage, 'sentences'> & {
  sentences: Sentence[]
  level: Level
  /** 1-based position within its level. */
  number: number
}
