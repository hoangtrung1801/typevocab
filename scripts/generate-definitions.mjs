#!/usr/bin/env node
// Generates a short English definition for every word of data/vocab/<level>.csv
// with the OpenAI API and writes them to src/data/definitions/<level>.json, so
// the app can show a word's meaning in English and the learner can guess the
// word from it.
//
// One request per unit. Answers are checked (length, plain ASCII, the word is
// not given away) and sent back with the problems until they pass; definitions
// already in the file are kept, so an interrupted run resumes where it stopped.
//
//   OPENAI_API_KEY=sk-... node scripts/generate-definitions.mjs --level a1
//
// Options and environment are the same as scripts/generate-passages.mjs:
//   --level a1|a2|b1|b2|c1|c2|all, --units 1-5,8, --limit N (units),
//   --concurrency N, --retries N, --force, --out DIR, --dry-run
//   OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL, OPENAI_API
import { runGenerator } from './lib/runner.mjs'
import {
  DEFINITION_SCHEMA,
  DEFINITION_SYSTEM_PROMPT,
  definitionUserPrompt,
  formatDefinitions,
  planDefinitionJobs,
  toDefinitions,
  validateDefinitions,
} from './lib/definition-gen.mjs'

runGenerator({
  name: 'definition',
  outDir: 'src/data/definitions/',
  systemPrompt: DEFINITION_SYSTEM_PROMPT,
  userPrompt: definitionUserPrompt,
  schema: DEFINITION_SCHEMA,
  planJobs: planDefinitionJobs,
  validate: validateDefinitions,
  build: toDefinitions,
  format: formatDefinitions,
  describe: (items) => `${items.length} definition(s)`,
})
