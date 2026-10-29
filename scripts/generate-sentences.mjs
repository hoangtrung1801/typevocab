#!/usr/bin/env node
// Generates short standalone sentences for the reverse translation mode, one
// per word of data/vocab/<level>.csv, with the OpenAI API, and writes them to
// src/data/sentences/<level>.json. Each sentence has 4-12 words and a
// Vietnamese translation; the learner rebuilds it from its shuffled words.
//
// One request per unit. Answers are checked and sent back with the problems
// until they pass; sentences already in the file are kept, so an interrupted
// run resumes where it stopped.
//
//   OPENAI_API_KEY=sk-... node scripts/generate-sentences.mjs --level a1
//
// Options and environment are the same as scripts/generate-passages.mjs:
//   --level a1|a2|b1|b2|c1|c2|all, --units 1-5,8, --limit N (units),
//   --concurrency N, --retries N, --force, --out DIR, --dry-run
//   OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL, OPENAI_API
import { runGenerator } from './lib/runner.mjs'
import {
  SENTENCE_SCHEMA,
  SENTENCE_SYSTEM_PROMPT,
  formatSentences,
  planSentenceJobs,
  sentenceUserPrompt,
  toSentences,
  validateSentences,
} from './lib/sentence-gen.mjs'

runGenerator({
  name: 'sentence',
  outDir: 'src/data/sentences/',
  systemPrompt: SENTENCE_SYSTEM_PROMPT,
  userPrompt: sentenceUserPrompt,
  schema: SENTENCE_SCHEMA,
  planJobs: planSentenceJobs,
  validate: validateSentences,
  build: toSentences,
  format: formatSentences,
  describe: (items) => `${items.length} sentence(s)`,
})
