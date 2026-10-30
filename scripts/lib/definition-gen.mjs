// Pure helpers for scripts/generate-definitions.mjs: short English definitions
// for the vocabulary words, so a learner can guess a word from its meaning in
// English. No network access here, so it can be unit tested.
import { posLabel, splitEvenly } from './passage-gen.mjs'
import { slug } from './sentence-gen.mjs'

export const MIN_WORDS = 2
export const MAX_WORDS = 18

/** Most words one request carries; units are rarely bigger. */
export const MAX_WORDS_PER_JOB = 20

const LEVEL_STYLE = {
  a1: 'only the most common English words (the 1,000 most frequent), very short',
  a2: 'simple, common words, short',
  b1: 'plain everyday words',
  b2: 'plain words; a less common word is fine when it is needed',
  c1: 'clear and precise, but simpler than the word being defined',
  c2: 'clear and precise, but simpler than the word being defined',
}

export const definitionId = (level, unit, lemma) => `${level}-u${String(unit).padStart(3, '0')}-${slug(lemma)}`

/** One job per unit (split when bigger than MAX_WORDS_PER_JOB). */
export function planDefinitionJobs(level, rows) {
  const units = new Map()
  for (const r of rows) {
    if (!units.has(r.unit)) units.set(r.unit, [])
    units.get(r.unit).push(r)
  }
  const jobs = []
  for (const [unit, words] of [...units].sort((a, b) => a[0] - b[0])) {
    splitEvenly(words, MAX_WORDS_PER_JOB).forEach((group, i) => {
      jobs.push({
        id: `${level}-u${String(unit).padStart(3, '0')}-d${i + 1}`,
        level,
        unit,
        topic: group[0].topic,
        words: group,
        itemIds: group.map((w) => definitionId(level, unit, w.lemma)),
      })
    })
  }
  return jobs
}

export const DEFINITION_SYSTEM_PROMPT = `You write short English definitions for a vocabulary trainer. A learner reads the definition and tries to guess the word, so the definition must point at the word without containing it.

Rules:
1. Write exactly one definition for each target word, for the part of speech and the meaning given (the Vietnamese gloss tells you which sense). When several parts of speech are listed, define the first one.
2. ${MIN_WORDS} to ${MAX_WORDS} words, one line, in the style of a learner's dictionary: "a young male person", "to become less hot", "not married". No capital letter at the start (unless the first word is a name), no full stop at the end, no example sentence.
3. Use simpler words than the target word, at the level the user message states. Never use the target word itself, nor another form of it (for "teach" do not write "teacher" or "teaching").
4. Make it specific enough that the word can be guessed: say what it is, what it does or what it is not, not just a vague synonym.
5. Plain ASCII only, with no "/", "|", "[" or "]".`

export function definitionUserPrompt(job, topicTitle) {
  const words = job.words.map((w) => `- ${w.lemma} (${posLabel(w.pos)}): ${w.meaning}`).join('\n')
  return `CEFR level of the words: ${job.level.toUpperCase()}
Words to define with: ${LEVEL_STYLE[job.level]}
Topic: ${topicTitle}
Target words (one definition each):
${words}`
}

/** JSON schema for structured output (strict mode: everything required, no extras). */
export const DEFINITION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['definitions'],
  properties: {
    definitions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'definition'],
        properties: { word: { type: 'string' }, definition: { type: 'string' } },
      },
    },
  },
}

/** True when the definition uses the word itself or a simple inflection of it. */
export function leaksWord(definition, lemma) {
  const text = definition.toLowerCase()
  const parts = lemma.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (parts.length > 1 && text.includes(parts.join(' '))) return true
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean)
  // Short parts ("to" in "go to") are too common to count; a part of 3+ letters
  // leaks as itself or with an ending ("-s", "-ed", "-ing", "-er", "-ly").
  return parts.some((p) => {
    if (p.length < 3) return false
    const stem = p.length >= 4 ? p.replace(/(e|y)$/, '') : p
    return tokens.some((t) => t === p || (t.startsWith(stem) && t.length <= stem.length + 3 && /^(s|es|ed|d|ing|er|ers|ly|ies|ied)$/.test(t.slice(stem.length))))
  })
}

/** Returns a list of problems with a model answer; empty means usable. */
export function validateDefinitions(out, job) {
  if (!out || typeof out !== 'object') return ['The answer is not a JSON object.']
  const problems = []
  const list = Array.isArray(out.definitions) ? out.definitions : []
  const targets = new Map(job.words.map((w) => [w.lemma.toLowerCase(), w.lemma]))
  const seen = new Set()

  for (const d of list) {
    const key = String(d?.word ?? '').trim().toLowerCase()
    const text = d?.definition ?? ''
    const where = `The definition of "${d?.word ?? '?'}"`
    if (!targets.has(key)) {
      problems.push(`"${d?.word}" is not a target word; define the target words only.`)
      continue
    }
    if (seen.has(key)) problems.push(`"${key}" has more than one definition.`)
    seen.add(key)

    if (!text.trim()) {
      problems.push(`${where} is empty.`)
      continue
    }
    if (text !== text.trim() || /\s{2,}/.test(text)) problems.push(`${where} has extra spaces.`)
    if (!/^[\x20-\x7e]*$/.test(text) || /[[\]|/]/.test(text)) problems.push(`${where} must be plain ASCII without "/", "|", "[" or "]" ("${text}").`)
    if (/[.!?]$/.test(text.trim())) problems.push(`${where} must not end with a full stop ("${text}").`)
    const n = text.split(/\s+/).filter(Boolean).length
    if (n < MIN_WORDS || n > MAX_WORDS) problems.push(`${where} has ${n} words; use ${MIN_WORDS} to ${MAX_WORDS} ("${text}").`)
    if (leaksWord(text, targets.get(key))) problems.push(`${where} contains the word itself or a form of it; explain it with other words ("${text}").`)
  }
  for (const [key, lemma] of targets) if (!seen.has(key)) problems.push(`Target word "${lemma}" has no definition.`)
  return problems
}

/** Turns a validated answer into the app's definition items, in the unit's word order. */
export function toDefinitions(out, job) {
  const byWord = new Map(out.definitions.map((d) => [d.word.trim().toLowerCase(), d]))
  return job.words.map((w) => ({
    id: definitionId(job.level, job.unit, w.lemma),
    word: w.lemma,
    pos: posLabel(w.pos),
    def: byWord.get(w.lemma.toLowerCase()).definition.trim(),
  }))
}

/** Sorted by unit and kept one definition per line, so diffs stay readable. */
export function formatDefinitions(items) {
  const order = (id) => id.match(/-u(\d+)-/)?.[1] ?? ''
  const sorted = [...items].sort((a, b) => order(a.id).localeCompare(order(b.id)))
  return `[\n${sorted.map((d) => `  ${JSON.stringify(d)}`).join(',\n')}\n]\n`
}
