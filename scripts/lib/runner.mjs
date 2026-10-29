// Shared driver for the content generators: command line options, calls to
// the OpenAI API with structured output, validation with retries, resuming
// from the existing output file, and parallel jobs. Each generator supplies
// how to plan jobs, prompt, check and assemble its own content.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LEVELS, readVocab } from './passage-gen.mjs'

const ROOT = new URL('../../', import.meta.url)
const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna'
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const API = process.env.OPENAI_API || 'responses'

export function parseArgs(argv) {
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
async function callModel(messages, name, schema) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
  const format = { type: 'json_schema', name, schema, strict: true }
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

/** Generates one job's content, sending problems back to the model until it passes. */
async function generate(gen, job, topics, retries) {
  const messages = [
    { role: 'system', content: gen.systemPrompt },
    { role: 'user', content: gen.userPrompt(job, topics[job.topic] ?? job.topic) },
  ]
  let problems = []
  for (let attempt = 1; attempt <= retries; attempt++) {
    const text = await callModel(messages, gen.name, gen.schema)
    let out
    try {
      out = JSON.parse(text)
    } catch {
      out = null
    }
    problems = gen.validate(out, job)
    if (problems.length === 0) return gen.build(out, job)
    messages.push(
      { role: 'assistant', content: text },
      { role: 'user', content: `Your answer has these problems:\n- ${problems.join('\n- ')}\nReturn the whole corrected answer.` },
    )
  }
  throw new Error(`still invalid after ${retries} attempts:\n    ${problems.join('\n    ')}`)
}

async function runLevel(gen, level, args, topics) {
  const outDir = args.out ? pathToFileURL(resolve(args.out) + '/') : new URL(gen.outDir, ROOT)
  const outFile = new URL(`${level}.json`, outDir)
  const existing = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : []
  const byId = new Map(existing.filter((p) => p.id).map((p) => [p.id, p]))

  let jobs = gen.planJobs(level, readVocab(level, ROOT))
  if (args.units) jobs = jobs.filter((j) => args.units.has(j.unit))
  // A job is done once everything it produces is in the file.
  if (!args.force) jobs = jobs.filter((j) => !j.itemIds.every((id) => byId.has(id)))
  jobs = jobs.slice(0, args.limit)

  if (args.dryRun) {
    const job = jobs[0]
    if (!job) return console.log(`${level}: nothing to generate`)
    console.log(`--- ${level}: ${jobs.length} job(s) to run; first is ${job.id} ---`)
    console.log(`[system]\n${gen.systemPrompt}\n\n[user]\n${gen.userPrompt(job, topics[job.topic] ?? job.topic)}`)
    return
  }

  console.log(`${level}: ${jobs.length} job(s) to generate with ${MODEL}`)
  let done = 0
  let failed = 0
  const save = () => writeFileSync(outFile, gen.format([...byId.values()]))
  const queue = [...jobs]
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const items = await generate(gen, job, topics, args.retries)
        for (const item of items) byId.set(item.id, item)
        save() // after every job, so an interrupted run loses nothing
        done++
        console.log(`  ✓ ${job.id} ${gen.describe(items)}`)
      } catch (err) {
        failed++
        console.error(`  ✗ ${job.id} ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker))
  console.log(`${level}: ${done} job(s) done, ${failed} failed, ${byId.size} ${gen.name}(s) in ${outFile.pathname}`)
  return failed
}

/**
 * Runs a generator from the command line. `gen` has: name, outDir (relative
 * to the repo), systemPrompt, userPrompt(job, topicTitle), schema,
 * planJobs(level, rows) -> jobs with { id, unit, topic, itemIds },
 * validate(out, job) -> problems, build(out, job) -> items with ids,
 * format(items) -> file text, describe(items) -> log line.
 */
export async function runGenerator(gen) {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (!args.dryRun && !process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY (or use --dry-run).')
    const topics = loadTopics()
    let failed = 0
    for (const level of args.level === 'all' ? LEVELS : [args.level]) failed += (await runLevel(gen, level, args, topics)) ?? 0
    if (failed) process.exitCode = 1
  } catch (err) {
    console.error(err.message)
    process.exit(2)
  }
}
