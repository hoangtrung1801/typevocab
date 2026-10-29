#!/usr/bin/env node
// Generates reading passages (for copy typing) from the vocabulary in
// data/vocab/<level>.csv with the OpenAI API and writes them to
// src/data/passages/<level>.json.
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
import { PASSAGE_SCHEMA, SYSTEM_PROMPT, formatPassages, planJobs, toPassage, userPrompt, validateGenerated } from './lib/passage-gen.mjs'
import { runGenerator } from './lib/runner.mjs'

runGenerator({
  name: 'passage',
  outDir: 'src/data/passages/',
  systemPrompt: SYSTEM_PROMPT,
  userPrompt,
  schema: PASSAGE_SCHEMA,
  planJobs: (level, rows) => planJobs(level, rows).map((job) => ({ ...job, itemIds: [job.id] })),
  validate: validateGenerated,
  build: (out, job) => [toPassage(out, job)],
  format: formatPassages,
  describe: ([passage]) => passage.title,
})
