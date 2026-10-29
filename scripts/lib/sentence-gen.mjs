// Pure helpers for scripts/generate-sentences.mjs: short standalone sentences
// for the reverse translation mode, one per vocabulary word. The learner sees
// the Vietnamese sentence and the English words shuffled, and types the
// English sentence back. No network access here, so it can be unit tested.
import { posLabel, splitEvenly } from './passage-gen.mjs'

/** Longest sentence, in words; the word bank stays small enough to scan. */
export const MAX_WORDS = 12
export const MIN_WORDS = 4

/** Most target words one request carries; units are rarely bigger. */
export const MAX_WORDS_PER_JOB = 12

const MARKUP = /\[([^\]|]+)(?:\|([^\]]+))?\]/g

const LENGTH_GUIDE = {
  a1: [4, 8, 'present simple and very common words only'],
  a2: [5, 10, 'everyday situations, simple past allowed'],
  b1: [6, 11, 'everyday and general topics'],
  b2: [7, 12, 'a range of tenses and some linking words'],
  c1: [7, 12, 'precise and varied vocabulary'],
  c2: [7, 12, 'sophisticated and idiomatic, still natural'],
}

export const slug = (lemma) =>
  lemma
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const sentenceId = (level, unit, lemma) => `${level}-u${String(unit).padStart(3, '0')}-${slug(lemma)}`

/** One job per unit (split when bigger than MAX_WORDS_PER_JOB); each word becomes one sentence. */
export function planSentenceJobs(level, rows) {
  const units = new Map()
  for (const r of rows) {
    if (!units.has(r.unit)) units.set(r.unit, [])
    units.get(r.unit).push(r)
  }
  const jobs = []
  for (const [unit, words] of [...units].sort((a, b) => a[0] - b[0])) {
    splitEvenly(words, MAX_WORDS_PER_JOB).forEach((group, i) => {
      jobs.push({
        id: `${level}-u${String(unit).padStart(3, '0')}-s${i + 1}`,
        level,
        unit,
        topic: group[0].topic,
        words: group,
        itemIds: group.map((w) => sentenceId(level, unit, w.lemma)),
      })
    })
  }
  return jobs
}

export const SENTENCE_SYSTEM_PROMPT = `You write short, standalone English sentences for Vietnamese learners, each with a Vietnamese translation. The learner reads the Vietnamese sentence, sees the English words shuffled, and types the English sentence back in the right order.

Rules:
1. Write exactly one sentence for each target word, using the word naturally with the meaning given. Inflected forms are fine (cages for cage, went for go).
2. Mark the target word in its sentence as [form|lemma], or [lemma] when the form equals the lemma. Example: "We cleaned the [cages|cage]." Mark nothing else.
3. Each sentence is one complete sentence of ${MIN_WORDS} to ${MAX_WORDS} words that makes sense on its own, without depending on any other sentence. Start with a capital letter and end with ".", "?" or "!".
4. Prefer a word order that is the only natural one, because the answer is checked word by word: avoid adverbs or time phrases that could just as well stand elsewhere, and avoid using the same word twice.
5. English must be plain ASCII: straight quotes only, no dashes other than "-", no emoji. Never use "/", "|", "[" or "]" except in the markup.
6. The Vietnamese translation is one natural, accurate Vietnamese sentence with the same meaning.
7. Keep to the given topic where it fits, and to the given CEFR level.`

export function sentenceUserPrompt(job, topicTitle) {
  const [min, max, style] = LENGTH_GUIDE[job.level]
  const words = job.words.map((w) => `- ${w.lemma} (${posLabel(w.pos)}): ${w.meaning}`).join('\n')
  return `CEFR level: ${job.level.toUpperCase()}
Length and style: ${min}-${max} words per sentence, ${style}
Topic: ${topicTitle}
Target words (one sentence each):
${words}`
}

/** JSON schema for structured output (strict mode: everything required, no extras). */
export const SENTENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sentences'],
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'en', 'vi'],
        properties: { word: { type: 'string' }, en: { type: 'string' }, vi: { type: 'string' } },
      },
    },
  },
}

const strip = (s) => s.replace(MARKUP, '$1')

/** Words as the app's word bank counts them: tokens with a letter or digit. */
export const wordCount = (en) =>
  strip(en)
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length

/** Returns a list of problems with a model answer; empty means usable. */
export function validateSentences(out, job) {
  if (!out || typeof out !== 'object') return ['The answer is not a JSON object.']
  const problems = []
  const sentences = Array.isArray(out.sentences) ? out.sentences : []
  const targets = new Map(job.words.map((w) => [w.lemma.toLowerCase(), w.lemma]))
  const seen = new Set()
  const texts = new Set()

  for (const s of sentences) {
    const key = String(s?.word ?? '')
      .trim()
      .toLowerCase()
    const en = s?.en ?? ''
    const vi = s?.vi ?? ''
    const where = `The sentence for "${s?.word ?? '?'}"`
    if (!targets.has(key)) {
      problems.push(`"${s?.word}" is not a target word; write one sentence per target word only.`)
      continue
    }
    if (seen.has(key)) problems.push(`"${key}" has more than one sentence.`)
    seen.add(key)

    if (!en.trim() || !vi.trim()) {
      problems.push(`${where} is empty or has no translation.`)
      continue
    }
    if (en !== en.trim() || vi !== vi.trim() || /\s{2,}/.test(en) || /\s{2,}/.test(vi))
      problems.push(`${where} has extra spaces.`)
    const marks = [...en.matchAll(MARKUP)].map((m) => (m[2] ?? m[1]).trim().toLowerCase())
    if (marks.length !== 1 || marks[0] !== key) problems.push(`${where} must mark "${key}" exactly once and nothing else ("${en}").`)
    const plain = strip(en)
    if (/[[\]|/]/.test(plain)) problems.push(`${where} has "/", "|" or broken markup ("${en}").`)
    if (!/^[\x20-\x7e]*$/.test(plain)) problems.push(`${where} has non-ASCII characters ("${en}").`)
    if (!/^[A-Z]/.test(plain) || !/[.?!]$/.test(plain))
      problems.push(`${where} must start with a capital letter and end with ".", "?" or "!" ("${en}").`)
    const n = wordCount(en)
    if (n < MIN_WORDS || n > MAX_WORDS) problems.push(`${where} has ${n} words; use ${MIN_WORDS} to ${MAX_WORDS} ("${en}").`)
    if (vi.includes('/')) problems.push(`${where}: "/" is not allowed in the translation.`)
    if (texts.has(plain.toLowerCase())) problems.push(`${where} repeats another sentence.`)
    texts.add(plain.toLowerCase())
  }
  for (const [key, lemma] of targets) if (!seen.has(key)) problems.push(`Target word "${lemma}" has no sentence.`)
  return problems
}

/** Turns a validated answer into the app's sentence items, in the unit's word order. */
export function toSentences(out, job) {
  const byWord = new Map(out.sentences.map((s) => [s.word.trim().toLowerCase(), s]))
  return job.words.map((w) => {
    const s = byWord.get(w.lemma.toLowerCase())
    return {
      id: sentenceId(job.level, job.unit, w.lemma),
      unit: job.unit,
      topic: job.topic,
      en: s.en,
      vi: s.vi.trim(),
      vocab: { [w.lemma.toLowerCase()]: { word: w.lemma, pos: posLabel(w.pos), ipa: w.ipa, vi: w.meaning } },
    }
  })
}

/** Sorted by unit and kept one sentence per line, so diffs stay readable. */
export function formatSentences(items) {
  const order = (id) => id.match(/-u(\d+)-/)?.[1] ?? ''
  const sorted = [...items].sort((a, b) => order(a.id).localeCompare(order(b.id)))
  return `[\n${sorted.map((s) => `  ${JSON.stringify(s)}`).join(',\n')}\n]\n`
}
