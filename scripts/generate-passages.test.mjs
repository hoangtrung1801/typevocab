// Runs the generator end to end against a local fake of the OpenAI API, for
// both the Responses and the Chat Completions formats.
import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SCRIPT = new URL('./generate-passages.mjs', import.meta.url).pathname

/** A valid passage for the target words listed in the prompt: one sentence per word. */
function answerFor(prompt, { skipFirst = false } = {}) {
  const words = [...prompt.matchAll(/^- (\S+) \(/gm)].map((m) => m[1])
  const sentences = words.map((w, i) => ({
    chunks: [{ en: skipFirst && i === 0 ? 'We see it.' : `We see the [${w}].`, vi: 'Chúng tôi thấy nó.' }],
  }))
  while (sentences.length < 3) sentences.push({ chunks: [{ en: 'It is nice.', vi: 'Nó đẹp.' }] })
  return JSON.stringify({ title: 'Test', titleVi: 'Thử', sentences })
}

let server
let baseUrl
const requests = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const json = JSON.parse(body)
      requests.push({ url: req.url, json })
      const messages = json.input ?? json.messages
      const prompt = messages[1].content
      // First attempt for each passage leaves a word out, so the retry path runs.
      const text = answerFor(prompt, { skipFirst: messages.length === 2 })
      res.setHeader('Content-Type', 'application/json')
      if (req.url === '/responses') {
        res.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }))
      } else {
        res.end(JSON.stringify({ choices: [{ message: { content: text } }] }))
      }
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => server.close())

function run(args, env) {
  return new Promise((resolve) => {
    execFile('node', [SCRIPT, ...args], { env: { ...process.env, OPENAI_API_KEY: 'test', OPENAI_BASE_URL: baseUrl, ...env } }, (err, stdout, stderr) =>
      resolve({ code: err?.code ?? 0, stdout, stderr }),
    )
  })
}

describe.each(['responses', 'chat'])('generate-passages with the %s API', (api) => {
  it('writes validated passages and resumes without regenerating them', async () => {
    const out = mkdtempSync(join(tmpdir(), 'typevocab-'))
    try {
      requests.length = 0
      const first = await run(['--level', 'a1', '--units', '1-2', '--out', out], { OPENAI_API: api, OPENAI_MODEL: 'test-model' })
      expect(first.stderr).toBe('')
      expect(first.code).toBe(0)

      const passages = JSON.parse(readFileSync(join(out, 'a1.json'), 'utf8'))
      expect(passages.map((p) => p.id)).toEqual(['a1-u001-1', 'a1-u001-2', 'a1-u002-1', 'a1-u002-2'])
      expect(passages[0].vocab.boy).toEqual({ word: 'boy', pos: 'noun', ipa: '/bɔɪ/', vi: 'cậu bé' })
      expect(passages[0].topic).toBe('fam')

      // Each passage needed a second attempt that carried the problem list.
      expect(requests).toHaveLength(8)
      expect(requests.every((r) => r.url === (api === 'chat' ? '/chat/completions' : '/responses'))).toBe(true)
      expect(requests.every((r) => r.json.model === 'test-model')).toBe(true)
      const retry = requests.find((r) => (r.json.input ?? r.json.messages).length === 4)
      expect((retry.json.input ?? retry.json.messages)[3].content).toMatch(/is missing or not marked/)

      requests.length = 0
      const second = await run(['--level', 'a1', '--units', '1-2', '--out', out], { OPENAI_API: api })
      expect(second.code).toBe(0)
      expect(second.stdout).toMatch(/0 passage\(s\) to generate/)
      expect(requests).toHaveLength(0)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})

describe('generate-passages options', () => {
  it('prints the prompt without calling the API on --dry-run', async () => {
    requests.length = 0
    const res = await run(['--level', 'c2', '--units', '1', '--force', '--dry-run'], { OPENAI_API_KEY: '' })
    expect(res.code).toBe(0)
    expect(res.stdout).toMatch(/CEFR level: C2/)
    expect(res.stdout).toMatch(/- hermit \(noun\): ẩn sĩ/)
    expect(requests).toHaveLength(0)
  })

  it('refuses to run without an API key', async () => {
    const res = await run(['--level', 'a1'], { OPENAI_API_KEY: '' })
    expect(res.code).toBe(2)
    expect(res.stderr).toMatch(/OPENAI_API_KEY/)
  })
})
