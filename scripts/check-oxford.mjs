// Checks that every target word is listed at its passage's CEFR level in the
// Oxford 3000/5000. The word list is not part of this repo; pass a JSON file
// shaped like {"word": [["B1", "n., v."], ...]}:
//
//   node scripts/check-oxford.mjs path/to/oxford.json
import { readFileSync } from 'node:fs'

const POS = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  determiner: 'det.',
  exclamation: 'exclam.',
  number: 'number',
  'modal verb': 'modal v.',
}

const listPath = process.argv[2]
if (!listPath) {
  console.error('Usage: node scripts/check-oxford.mjs <oxford.json>')
  process.exit(2)
}
const oxford = JSON.parse(readFileSync(listPath, 'utf8'))

let problems = 0
for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
  const url = new URL(`../src/data/passages/${level.toLowerCase()}.json`, import.meta.url)
  const passages = JSON.parse(readFileSync(url, 'utf8'))
  passages.forEach((p, i) => {
    for (const v of Object.values(p.vocab)) {
      const entries = oxford[v.word.toLowerCase()] ?? []
      const abbr = POS[v.pos]
      const ok = entries.some(([l, pos]) => l === level && (!abbr || pos.includes(abbr)))
      if (!ok) {
        problems++
        const found = entries.map(([l, pos]) => `${l} ${pos}`).join('; ') || 'not listed'
        console.log(`${level} #${i + 1} "${p.title}": ${v.word} (${v.pos}) -> ${found}`)
      }
    }
  })
}
console.log(problems ? `${problems} problem(s)` : 'All target words match their level.')
process.exit(problems ? 1 : 0)
