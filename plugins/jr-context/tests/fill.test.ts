import { test, expect } from 'claude-code/testing'

import { barWidth, fillOf } from '../hooks/fill'
import { bar, colorAt, GRADIENTS } from '../hooks/jr/gradient'

test('no figures yet, no bar', async () => {
  expect(fillOf({ window: 200_000 })).toBe(null)
})

test('percent is computed when the engine gives none', async () => {
  expect(fillOf({ tokens: 50_000, window: 200_000 })?.percent).toBe(25)
})

test('the bar shrinks to fit a narrow band', async () => {
  expect(barWidth('wide', 60)).toBe(20)
  expect(barWidth('normal', 200)).toBe(24)
})

test('a half bar fills half its cells', async () => {
  const cells = bar(0.5, 10, GRADIENTS.heat)
  expect(cells.filter(c => !c.empty).length).toBe(5)
})

test('the heat gradient runs green to red', async () => {
  expect(colorAt(GRADIENTS.heat, 0)).toBe('#2cb67d')
  expect(colorAt(GRADIENTS.heat, 1)).toBe('#ef4565')
})
