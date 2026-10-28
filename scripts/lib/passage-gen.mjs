// Pure helpers for scripts/generate-passages.mjs: reading the vocabulary,
// grouping it into passages, building the prompt, and checking and
// assembling what the model returns. No network access here, so it can be
// unit tested.
import { readFileSync } from 'node:fs'

export const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

/** Most target words a single passage carries; bigger units are split. */
export const MAX_WORDS_PER_PASSAGE = 8

const MARKUP = /\[([^\]|]+)(?:\|([^\]]+))?\]/g

const POS_NAMES = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  prep: 'preposition',
  conj: 'conjunction',
  pron: 'pronoun',
  det: 'determiner',
  art: 'article',
  excl: 'exclamation',
  num: 'number',
  ord: 'ordinal number',
  modal: 'modal verb',
  aux: 'auxiliary verb',
  link: 'linking verb',
  to: 'infinitive marker',
}

/** "n/v" -> "noun, verb" */
export function posLabel(pos) {
  return pos
    .split('/')
    .map((p) => POS_NAMES[p.trim()] ?? p.trim())
    .join(', ')
}

/** Keeps the first /.../ transcription; some rows add narrow detail in [brackets]. */
export function cleanIpa(ipa) {
  return ipa.match(/\/[^/]+\//)?.[0] ?? ''
}

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes). */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '')
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

/** Rows of data/vocab/<level>.csv as { unit, lemma, pos, meaning, ipa, topic }. */
export function readVocab(level, root) {
  const text = readFileSync(new URL(`data/vocab/${level}.csv`, root), 'utf8')
  return parseCsv(text).map((r) => ({
    unit: Number(r.unit),
    lemma: r.lemma.trim(),
    pos: r.pos.trim(),
    meaning: r.meaning_vi.trim(),
    ipa: cleanIpa(r.ipa),
    topic: r.topic.trim(),
  }))
}

/** Splits n items into the fewest groups of at most `max`, sizes as even as possible. */
export function splitEvenly(items, max = MAX_WORDS_PER_PASSAGE) {
  const groups = Math.max(1, Math.ceil(items.length / max))
  const out = []
  let start = 0
  for (let g = 0; g < groups; g++) {
    const size = Math.floor(items.length / groups) + (g < items.length % groups ? 1 : 0)
    out.push(items.slice(start, start + size))
    start += size
  }
  return out
}

/**
 * One job per passage to generate: each unit becomes one passage, or several
 * when it has more than MAX_WORDS_PER_PASSAGE words.
 */
export function planJobs(level, rows) {
  const units = new Map()
  for (const r of rows) {
    if (!units.has(r.unit)) units.set(r.unit, [])
    units.get(r.unit).push(r)
  }
  const jobs = []
  for (const [unit, words] of [...units].sort((a, b) => a[0] - b[0])) {
    splitEvenly(words).forEach((group, i) => {
      jobs.push({
        id: `${level}-u${String(unit).padStart(3, '0')}-${i + 1}`,
        level,
        unit,
        part: i + 1,
        // A unit is one topic; take the most common if a unit mixes them.
        topic: mostCommon(group.map((w) => w.topic)),
        words: group,
      })
    })
  }
  return jobs
}

function mostCommon(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0][0]
}

const LENGTH_GUIDE = {
  a1: '4-5 short, simple sentences (about 6-10 words each), present simple and very common words only',
  a2: '4-6 simple sentences (about 8-12 words each), everyday situations, simple past allowed',
  b1: '5-6 sentences (about 10-16 words each), a clear little story or description',
  b2: '5-6 sentences (about 12-20 words each), some complex sentences and linking words',
  c1: '5-7 sentences (about 14-24 words each), varied structures, an essay or feature style',
  c2: '5-7 sentences (about 16-28 words each), sophisticated and idiomatic, still natural',
}

export const SYSTEM_PROMPT = `You write short English reading passages for Vietnamese learners, with a Vietnamese translation aligned phrase by phrase. Learners type the English text on a keyboard while the matching Vietnamese phrase is revealed.

Rules:
1. Use EVERY target word at least once, in a natural way and with the meaning given. Inflected forms are fine (cages for cage, went for go).
2. Mark the first use of each target word as [form|lemma], or [lemma] when the form equals the lemma. Example: "the [cages|cage]", "a small [cage]". Mark nothing else, never the same word twice, and only words from the target list.
3. English must be plain ASCII: straight quotes only, no curly quotes, no dashes other than "-", no emoji. Never use "/", "|", "[" or "]" except in the markup.
4. Split every sentence into phrases ("chunks"), in English order. Each chunk has the English phrase and its Vietnamese translation. Read in order, the Vietnamese chunks must form one natural, correct Vietnamese sentence. When Vietnamese word order differs from English (for example "a small house" -> "một ngôi nhà nhỏ"), keep the reordered words inside one chunk so chunk order still matches.
5. Any sentence longer than five words has at least two chunks. Never split a marked word or phrase across chunks. Punctuation stays with the word it follows.
6. Write a coherent passage about the given topic, suitable for the given CEFR level, with an English title and a Vietnamese title.`

export function userPrompt(job, topicTitle) {
  const words = job.words.map((w) => `- ${w.lemma} (${posLabel(w.pos)}): ${w.meaning}`).join('\n')
  return `CEFR level: ${job.level.toUpperCase()}
Length and style: ${LENGTH_GUIDE[job.level]}
Topic: ${topicTitle}
Target words:
${words}`
}

/** JSON schema for structured output (strict mode: everything required, no extras). */
export const PASSAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'titleVi', 'sentences'],
  properties: {
    title: { type: 'string' },
    titleVi: { type: 'string' },
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['chunks'],
        properties: {
          chunks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['en', 'vi'],
              properties: { en: { type: 'string' }, vi: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

const strip = (s) => s.replace(MARKUP, '$1')

/** Returns a list of problems with a model answer; empty means usable. */
export function validateGenerated(out, job) {
  const problems = []
  if (!out || typeof out !== 'object') return ['The answer is not a JSON object.']
  if (!out.title?.trim() || !out.titleVi?.trim()) problems.push('Both title and titleVi are required.')
  const sentences = Array.isArray(out.sentences) ? out.sentences : []
  if (sentences.length < 3 || sentences.length > 8) problems.push(`Write 3 to 8 sentences (got ${sentences.length}).`)

  const targets = new Map(job.words.map((w) => [w.lemma.toLowerCase(), w.lemma]))
  const marked = []
  sentences.forEach((s, si) => {
    const chunks = Array.isArray(s?.chunks) ? s.chunks : []
    const where = `Sentence ${si + 1}`
    if (chunks.length === 0) {
      problems.push(`${where} has no chunks.`)
      return
    }
    for (const c of chunks) {
      const en = c?.en ?? ''
      const vi = c?.vi ?? ''
      if (!en.trim() || !vi.trim()) problems.push(`${where} has an empty chunk.`)
      if (en !== en.trim() || vi !== vi.trim() || /\s{2,}/.test(en) || /\s{2,}/.test(vi))
        problems.push(`${where}: chunks must not have extra spaces ("${en}").`)
      const plain = strip(en)
      if (/[[\]|]/.test(plain)) problems.push(`${where}: broken markup in "${en}".`)
      if (plain.includes('/') || vi.includes('/')) problems.push(`${where}: "/" is not allowed ("${en}" / "${vi}").`)
      if (!/^[\x20-\x7e]*$/.test(plain)) problems.push(`${where}: non-ASCII characters in "${en}".`)
      for (const m of en.matchAll(MARKUP)) marked.push((m[2] ?? m[1]).trim().toLowerCase())
    }
    const words = strip(chunks.map((c) => c?.en ?? '').join(' ')).split(' ').length
    if (words > 5 && chunks.length < 2) problems.push(`${where} has ${words} words but only one chunk; split it into phrases.`)
  })

  for (const key of marked) if (!targets.has(key)) problems.push(`"${key}" is marked but is not a target word.`)
  const seen = new Set()
  for (const key of marked) {
    if (seen.has(key)) problems.push(`"${key}" is marked more than once; mark only its first use.`)
    seen.add(key)
  }
  for (const [key, lemma] of targets) if (!seen.has(key)) problems.push(`Target word "${lemma}" is missing or not marked.`)
  return problems
}

/** Turns a validated answer into the app's passage format. */
export function toPassage(out, job) {
  return {
    id: job.id,
    unit: job.unit,
    topic: job.topic,
    title: out.title.trim(),
    titleVi: out.titleVi.trim(),
    sentences: out.sentences.map((s) => ({
      en: s.chunks.map((c) => c.en).join(' / '),
      vi: s.chunks.map((c) => c.vi).join(' / '),
    })),
    vocab: Object.fromEntries(
      job.words.map((w) => [
        w.lemma.toLowerCase(),
        { word: w.lemma, pos: posLabel(w.pos), ipa: w.ipa, vi: w.meaning },
      ]),
    ),
  }
}

/** Stable order for a level file: by unit, then part. */
export function sortPassages(passages) {
  return [...passages].sort((a, b) => a.id.localeCompare(b.id))
}

/** One sentence per line, like the hand-edited files, so diffs stay readable. */
export function formatPassages(passages) {
  const text = JSON.stringify(sortPassages(passages), null, 2)
  return (
    text
      .replace(/\{\n\s+"en": (".*?"),\n\s+"vi": (".*?")\n\s+\}/g, '{ "en": $1, "vi": $2 }')
      .replace(
        /\{\n\s+"word": (".*?"),\n\s+"pos": (".*?"),\n\s+"ipa": (".*?"),\n\s+"vi": (".*?")\n\s+\}/g,
        '{ "word": $1, "pos": $2, "ipa": $3, "vi": $4 }',
      ) + '\n'
  )
}
