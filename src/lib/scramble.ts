import { parsePassage, stripMarkup } from './passage'

/** One word of the English sentence, as a tile in the shuffled word bank. */
export type Tile = {
  /** The word as shown on the tile, without surrounding punctuation. */
  text: string
  /** Lowercase form used for matching what is typed. */
  norm: string
  /** Vocab key when the word is (part of) a target word. */
  vocab: string | null
  /** Position of the word in the sentence. */
  index: number
}

/** Strips punctuation around a word but keeps apostrophes and hyphens inside it. */
export function cleanWord(word: string): string {
  return word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
}

export const normWord = (word: string) => cleanWord(word).toLowerCase()

/** The words a learner types, normalised for comparison. */
export function typedWords(input: string): string[] {
  return input.split(/\s+/).map(normWord).filter(Boolean)
}

/**
 * Words written with a capital letter somewhere other than the start of a
 * sentence, such as names. They keep their capital on the tiles; any other
 * sentence-initial word is shown in lowercase so it does not give away the
 * first word.
 */
export function properWords(sentences: string[]): Set<string> {
  const out = new Set<string>()
  for (const en of sentences) {
    stripMarkup(en)
      .split(/\s+/)
      .slice(1)
      .map(cleanWord)
      .forEach((w) => {
        if (/^[A-Z]/.test(w)) out.add(w)
      })
  }
  return out
}

/** The sentence's words in order, as tiles. */
export function sentenceTiles(en: string, proper: Set<string> = new Set()): Tile[] {
  const parsed = parsePassage([{ en }])
  const tiles: Tile[] = []
  for (const word of parsed.words) {
    const raw = cleanWord(word.chars.map((i) => parsed.chars[i].ch).join(''))
    if (!raw) continue
    const keepCase = tiles.length > 0 || proper.has(raw) || /^I('|$)/.test(raw) || raw.slice(1) !== raw.slice(1).toLowerCase()
    const text = keepCase ? raw : raw[0].toLowerCase() + raw.slice(1)
    tiles.push({ text, norm: raw.toLowerCase(), vocab: word.vocab, index: tiles.length })
  }
  return tiles
}

/** Small deterministic PRNG so a sentence shuffles the same way on every render. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/**
 * The tiles in a shuffled order, the same for the same seed. The result is
 * never the sentence's own word order when another order exists.
 */
export function shuffleTiles(tiles: Tile[], seed: string): Tile[] {
  const random = seeded(seed)
  const out = [...tiles]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  const inOrder = out.every((t, i) => t.norm === tiles[i].norm)
  if (inOrder && new Set(tiles.map((t) => t.norm)).size > 1) {
    // Rotating changes the order unless every word is the same.
    let k = 1
    while (out.every((t, i) => t.norm === tiles[(i + k) % tiles.length].norm)) k++
    return tiles.map((_, i) => tiles[(i + k) % tiles.length])
  }
  return out
}

/**
 * Which tiles the typed words use up, and which typed words are not in the
 * bank at all. Each typed word takes the first unused tile with that word.
 */
export function matchTiles(tiles: Tile[], typed: string[]): { used: Set<number>; unknown: string[] } {
  const used = new Set<number>()
  const unknown: string[] = []
  for (const word of typed) {
    const tile = tiles.find((t) => t.norm === word && !used.has(t.index))
    if (tile) used.add(tile.index)
    else unknown.push(word)
  }
  return { used, unknown }
}

/** True when the typed words are the sentence's words in order (case and punctuation aside). */
export function isCorrectOrder(tiles: Tile[], typed: string[]): boolean {
  return typed.length === tiles.length && tiles.every((t, i) => t.norm === typed[i])
}

/**
 * The next word position to hint: the first one not typed correctly that has
 * not been hinted yet. -1 when there is nothing left to hint.
 */
export function nextWordHint(tiles: Tile[], typed: string[], hinted: Set<number>): number {
  return tiles.find((t, i) => t.norm !== typed[i] && !hinted.has(i))?.index ?? -1
}
