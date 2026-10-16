import { test, expect } from 'claude-code/testing'

import { fillOf, isNearCompaction, miniBar, share, stackedBar } from '../hooks/fill'

export const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 2_200, kind: 'used' },
    { name: 'System tools', tokens: 21_000, kind: 'used' },
    { name: 'MCP tools', tokens: 40_000, kind: 'deferred' },
    { name: 'Messages', tokens: 233_000, kind: 'used' },
    { name: 'Free space', tokens: 711_000, kind: 'free' },
    { name: 'Autocompact buffer', tokens: 33_000, kind: 'buffer' },
  ],
  totalTokens: 256_200,
  rawMaxTokens: 1_000_000,
  percentage: 26,
} as const

test('keeps the used rows, drops deferred ones, reads the buffer', async () => {
  const fill = fillOf(BREAKDOWN)!
  expect(fill.used.map(s => s.name)).toEqual(['system prompt', 'system tools', 'messages'])
  expect(fill.buffer).toBe(33_000)
})

test('no breakdown yet, no bar', async () => {
  expect(fillOf(undefined)).toBe(null)
})

test('the stacked bar is exactly the width, used then free then buffer', async () => {
  const cells = stackedBar(fillOf(BREAKDOWN)!, 100)
  expect(cells.length).toBe(100)
  expect(cells[0]!.kind).toBe('used')
  expect(cells[99]!.kind).toBe('buffer')
  expect(cells.filter(c => c.kind === 'used').length).toBe(26)
})

test('a tiny category still shows one cell', async () => {
  const fill = { used: [{ name: 'a', tokens: 10 }], total: 10, max: 1_000_000, buffer: 0, percent: 0 }
  expect(stackedBar(fill, 50).filter(c => c.kind === 'used').length).toBe(1)
})

test('shares read like /context', async () => {
  expect(share(494, 1_000_000)).toBe('<0.1%')
  expect(share(2_200, 1_000_000)).toBe('0.2%')
  expect(share(233_000, 1_000_000)).toBe('23%')
})

test('the mini bar is exactly the width and fills in proportion, tiny categories may vanish', async () => {
  const cells = miniBar(fillOf(BREAKDOWN)!, 20)
  expect(cells.length).toBe(20)
  expect(cells.filter(c => c.kind === 'used').length).toBe(5)
  expect(cells[19]!.kind).toBe('free')
  const tiny = { used: [{ name: 'a', tokens: 10 }], total: 10, max: 1_000_000, buffer: 0, percent: 0 }
  expect(miniBar(tiny, 20).filter(c => c.kind === 'used').length).toBe(1)
})

test('compaction is near at the threshold share of where it starts, not of the window', async () => {
  const at = (percent: number) => ({ ...fillOf(BREAKDOWN)!, percent })
  expect(isNearCompaction(at(77), 80)).toBe(false)
  expect(isNearCompaction(at(78), 80)).toBe(true)
})
