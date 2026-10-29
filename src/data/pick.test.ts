import { describe, expect, it } from 'vitest'
import { pickPassage } from '.'

const passages = ['a', 'b', 'c', 'd'].map((id) => ({ id }))

describe('pickPassage', () => {
  it('prefers passages not typed yet', () => {
    const done = (id: string) => id !== 'c'
    for (const r of [0, 0.5, 0.99]) expect(pickPassage(passages, done, undefined, () => r)?.id).toBe('c')
  })

  it('picks among all the others once every passage is done, never the current one', () => {
    const seen = new Set([0, 0.34, 0.67, 0.99].map((r) => pickPassage(passages, () => true, 'b', () => r)?.id))
    expect(seen).toEqual(new Set(['a', 'c', 'd']))
  })

  it('skips the current passage even when it is the only one left to type', () => {
    expect(pickPassage(passages, (id) => id !== 'a', 'a', () => 0)?.id).toBe('b')
  })

  it('returns the only passage of a level, and nothing for an empty level', () => {
    expect(pickPassage([{ id: 'x' }], () => false, 'x')?.id).toBe('x')
    expect(pickPassage([], () => false)).toBeUndefined()
  })
})
