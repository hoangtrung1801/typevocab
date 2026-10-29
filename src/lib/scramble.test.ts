import { describe, expect, it } from 'vitest'
import {
  cleanWord,
  isCorrectOrder,
  matchTiles,
  nextWordHint,
  properWords,
  sentenceTiles,
  shuffleTiles,
  typedWords,
} from './scramble'

describe('sentenceTiles', () => {
  it('splits into words without punctuation, keeping vocab keys', () => {
    const tiles = sentenceTiles('On Sunday, we ate [ice cream] at my [uncle\'s|uncle] farm.')
    expect(tiles.map((t) => t.text)).toEqual(['on', 'Sunday', 'we', 'ate', 'ice', 'cream', 'at', 'my', "uncle's", 'farm'])
    expect(tiles.map((t) => t.vocab)).toEqual([null, null, null, null, 'ice cream', 'ice cream', null, null, 'uncle', null])
    expect(tiles.map((t) => t.index)).toEqual([...Array(10).keys()])
  })

  it('keeps the capital of a first word that is a name, "I", or an acronym', () => {
    expect(sentenceTiles('Tom is here.', new Set(['Tom']))[0].text).toBe('Tom')
    expect(sentenceTiles("I'm late.")[0].text).toBe("I'm")
    expect(sentenceTiles('TV is fun.')[0].text).toBe('TV')
    expect(sentenceTiles('Tom is here.')[0].text).toBe('tom')
  })

  it('drops tokens that are only punctuation', () => {
    expect(sentenceTiles('Wait - "now"!').map((t) => t.text)).toEqual(['wait', 'now'])
  })
})

describe('properWords', () => {
  it('collects words capitalised after the start of a sentence', () => {
    expect([...properWords(['She met [Tom|tom] in London.', 'Yes, I did.'])]).toEqual(['Tom', 'London', 'I'])
  })
})

describe('shuffleTiles', () => {
  const tiles = sentenceTiles('She has one son and two daughters.')

  it('is deterministic for a seed and keeps every tile', () => {
    const a = shuffleTiles(tiles, 'x')
    expect(shuffleTiles(tiles, 'x')).toEqual(a)
    expect([...a].sort((p, q) => p.index - q.index)).toEqual(tiles)
  })

  it('never returns the original order when another exists', () => {
    for (let s = 0; s < 200; s++) {
      const two = sentenceTiles('Go home.')
      expect(shuffleTiles(two, String(s)).map((t) => t.text)).toEqual(['home', 'go'])
      expect(shuffleTiles(tiles, String(s)).map((t) => t.norm)).not.toEqual(tiles.map((t) => t.norm))
    }
    expect(shuffleTiles(sentenceTiles('No no.'), 'a').map((t) => t.norm)).toEqual(['no', 'no'])
  })
})

describe('typing against the bank', () => {
  const tiles = sentenceTiles('The cat saw the dog.')

  it('normalises typed words', () => {
    expect(cleanWord('"well-being,"')).toBe('well-being')
    expect(typedWords('  The  CAT, saw ')).toEqual(['the', 'cat', 'saw'])
  })

  it('uses up one tile per typed word and reports words not in the bank', () => {
    const { used, unknown } = matchTiles(tiles, ['the', 'the', 'the', 'bird'])
    expect([...used]).toEqual([0, 3])
    expect(unknown).toEqual(['the', 'bird'])
  })

  it('checks the order, ignoring case and punctuation', () => {
    expect(isCorrectOrder(tiles, typedWords('the cat saw the dog'))).toBe(true)
    expect(isCorrectOrder(tiles, typedWords('The dog saw the cat.'))).toBe(false)
    expect(isCorrectOrder(tiles, typedWords('The cat saw the'))).toBe(false)
  })

  it('hints the first word not yet right', () => {
    expect(nextWordHint(tiles, [], new Set())).toBe(0)
    expect(nextWordHint(tiles, ['the', 'cat'], new Set())).toBe(2)
    expect(nextWordHint(tiles, ['the', 'cat'], new Set([2]))).toBe(3)
    expect(nextWordHint(tiles, typedWords('the cat saw the dog'), new Set())).toBe(-1)
  })
})
