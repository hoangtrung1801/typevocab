#!/usr/bin/env node
// Generates reading passages from the vocabulary in data/vocab/<level>.csv with
// the OpenAI API and writes them to src/data/passages/<level>.json.
//
// Each unit of the vocabulary becomes one passage (two when the unit has more
// than 8 words). Every answer is checked; a bad answer is sent back to the
// model with the list of problems, a few times, before the job is skipped.
// Passages already in the output file are kept, so an interrupted run can be
// resumed by running the same command again.
//
//   OPENAI_API_KEY=sk-... node scripts/generate-passages.mjs --level a1
//
// Options:
//   --level a1|a2|b1|b2|c1|c2|all   level(s) to generate (required)
//   --units 1-5,8                   only these units
//   --limit N                       stop after N new passages
//   --concurrency N                 parallel requests (default 3)
//   --retries N                     attempts per passage (default 3)
//   --force                         regenerate passages that already exist
//   --out DIR                       output folder (default src/data/passages)
//   --dry-run                       print the first prompt and exit, no API call
//
// Environment:
//   OPENAI_API_KEY    required unless --dry-run
//   OPENAI_MODEL      model name (default gpt-6-luna)
//   OPENAI_BASE_URL   API base URL (default https://api.openai.com/v1)
//   OPENAI_API        "responses" (default) or "chat" for Chat Completions,
//                     e.g. with OpenAI-compatible providers
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  LEVELS,
  PASSAGE_SCHEMA,
  SYSTEM_PROMPT,
  formatPassages,
  planJobs,
  readVocab,
  toPassage,
  userPrompt,
  validateGenerated,
} from './lib/passage-gen.mjs'

const ROOT = new URL('../', import.meta.url)
const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna'
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const API = process.env.OPENAI_API || 'responses'

function parseArgs(argv) {
  const args = { concurrency: 3, retries: 3, limit: Infinity, force: false, dryRun: false, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--level') args.level = next().toLowerCase()
    else if (a === '--units') args.units = parseUnits(next())
    else if (a === '--limit') args.limit = Number(next())
    else if (a === '--concurrency') args.concurrency = Number(next())
    else if (a === '--retries') args.retries = Number(next())
    else if (a === '--force') args.force = true
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--out') args.out = next()
    else throw new Error(`Unknown option ${a}`)
  }
  if (!args.level) throw new Error('--level is required (a1, a2, b1, b2, c1, c2 or all)')
  if (args.level !== 'all' && !LEVELS.includes(args.level)) throw new Error(`Unknown level ${args.level}`)
  return args
}

function parseUnits(spec) {
  const units = new Set()
  for (const part of spec.split(',')) {
    const [from, to = from] = part.split('-').map(Number)
    for (let u = from; u <= to; u++) units.add(u)
  }
  return units
}

function loadTopics() {
  const text = readFileSync(new URL('src/data/topics.ts', ROOT), 'utf8')
  return Object.fromEntries([...text.matchAll(/key: '(\w+)', title: '([^']+)'/g)].map((m) => [m[1], m[2]]))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** One API call; retries transient HTTP errors with backoff. */
async function callModel(messages) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
  const format = { type: 'json_schema', name: 'passage', schema: PASSAGE_SCHEMA, strict: true }
  const [url, body] =
    API === 'chat'
      ? [`${BASE_URL}/chat/completions`, { model: MODEL, messages, response_format: { type: 'json_schema', json_schema: format } }]
      : [`${BASE_URL}/responses`, { model: MODEL, input: messages, text: { format } }]

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) })
    if (res.ok) {
      const data = await res.json()
      return API === 'chat' ? chatText(data) : responsesText(data)
    }
    const detail = (await res.text()).slice(0, 500)
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** attempt
      console.warn(`  HTTP ${res.status}, retrying in ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      continue
    }
    throw new Error(`HTTP ${res.status}: ${detail}`)
  }
}

function responsesText(data) {
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue
    for (const c of item.content ?? []) {
      if (c.type === 'output_text') return c.text
      if (c.type === 'refusal') throw new Error(`Model refused: ${c.refusal}`)
    }
  }
  throw new Error(`No text in response (status ${data.status ?? 'unknown'})`)
}

function chatText(data) {
  const msg = data.choices?.[0]?.message
  if (msg?.refusal) throw new Error(`Model refused: ${msg.refusal}`)
  if (!msg?.content) throw new Error('No content in response')
  return msg.content
}

/** Generates one passage, sending problems back to the model until it passes. */
async function generate(job, topics, retries) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt(job, topics[job.topic] ?? job.topic) },
  ]
  let problems = []
  for (let attempt = 1; attempt <= retries; attempt++) {
    const text = await callModel(messages)
    let out
    try {
      out = JSON.parse(text)
    } catch {
      out = null
    }
    problems = validateGenerated(out, job)
    if (problems.length === 0) return toPassage(out, job)
    messages.push(
      { role: 'assistant', content: text },
      { role: 'user', content: `Your answer has these problems:\n- ${problems.join('\n- ')}\nReturn the whole corrected passage.` },
    )
  }
  throw new Error(`still invalid after ${retries} attempts:\n    ${problems.join('\n    ')}`)
}

async function runLevel(level, args, topics) {
  const outDir = args.out ? pathToFileURL(resolve(args.out) + '/') : new URL('src/data/passages/', ROOT)
  const outFile = new URL(`${level}.json`, outDir)
  const existing = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : []
  const byId = new Map(existing.filter((p) => p.id).map((p) => [p.id, p]))

  let jobs = planJobs(level, readVocab(level, ROOT))
  if (args.units) jobs = jobs.filter((j) => args.units.has(j.unit))
  if (!args.force) jobs = jobs.filter((j) => !byId.has(j.id))
  jobs = jobs.slice(0, args.limit)

  if (args.dryRun) {
    const job = jobs[0]
    if (!job) return console.log(`${level}: nothing to generate`)
    console.log(`--- ${level}: ${jobs.length} passage(s) to generate; first is ${job.id} ---`)
    console.log(`[system]\n${SYSTEM_PROMPT}\n\n[user]\n${userPrompt(job, topics[job.topic] ?? job.topic)}`)
    return
  }

  console.log(`${level}: ${jobs.length} passage(s) to generate with ${MODEL}`)
  let done = 0
  let failed = 0
  const save = () => writeFileSync(outFile, formatPassages([...byId.values()]))
  const queue = [...jobs]
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const passage = await generate(job, topics, args.retries)
        byId.set(job.id, passage)
        save() // after every passage, so an interrupted run loses nothing
        done++
        console.log(`  ✓ ${job.id} ${passage.title}`)
      } catch (err) {
        failed++
        console.error(`  ✗ ${job.id} ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker))
  console.log(`${level}: ${done} written, ${failed} failed, ${byId.size} passages in ${outFile.pathname}`)
  return failed
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dryRun && !process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY (or use --dry-run).')
  const topics = loadTopics()
  let failed = 0
  for (const level of args.level === 'all' ? LEVELS : [args.level]) failed += (await runLevel(level, args, topics)) ?? 0
  if (failed) process.exitCode = 1
}

main().catch((err) => {
  console.error(err.message)
  process.exit(2)
})
