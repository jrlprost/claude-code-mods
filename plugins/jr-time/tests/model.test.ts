import { test, expect } from 'claude-code/testing'

import { addPresence, billable, classify, DEFAULT_SETTINGS, periodStart, report, toCsv } from '../hooks/model'
import type { JrTimeSession } from '../types'

const MIN = 60_000
const T0 = new Date(2026, 9, 15, 9, 0, 0).getTime() // 15 Oct 2026, 09:00 local

// One prompt at 9:00, Claude works 9:00–9:20; you are at the computer until 9:10, back 9:25–9:30.
const session: JrTimeSession = {
  id: 's1',
  project: 'tokenkarma',
  start: T0,
  last: T0 + 30 * MIN,
  prompts: [T0],
  turns: [[T0, T0 + 20 * MIN]],
  present: [[T0, T0 + 10 * MIN], [T0 + 25 * MIN, T0 + 30 * MIN]],
  hasPresence: true,
}

test('each slot gets one category: window, then Claude with or without you, then between, then break', async () => {
  const c = classify(session, DEFAULT_SETTINGS, 0, Infinity)
  expect(c.window).toBe(5 * MIN) // 9:00–9:05
  expect(c.withYou).toBe(5 * MIN) // 9:05–9:10
  expect(c.alone).toBe(10 * MIN) // 9:10–9:20
  expect(c.break).toBe(5 * MIN) // 9:20–9:25, away
  expect(c.elsewhere).toBe(5 * MIN) // 9:25–9:30, at the computer but more than 5 min after Claude's last activity
  expect(c.between).toBe(0)
})

test('nothing is counted twice: the categories add up to the session', async () => {
  const c = classify(session, DEFAULT_SETTINGS, 0, Infinity)
  expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(30 * MIN)
})

test('a longer prompt window takes over Claude time, never adds to it', async () => {
  const c = classify(session, { ...DEFAULT_SETTINGS, windowMin: 15 }, 0, Infinity)
  expect(c.window).toBe(15 * MIN)
  expect(c.window + c.withYou + c.alone).toBe(20 * MIN)
})

test('two prompts two minutes apart: the window restarts, it is not doubled', async () => {
  const twice = { ...session, prompts: [T0, T0 + 2 * MIN] }
  expect(classify(twice, DEFAULT_SETTINGS, 0, Infinity).window).toBe(7 * MIN)
})

test('ratios weight each category', async () => {
  const c = classify(session, DEFAULT_SETTINGS, 0, Infinity)
  // 5 + 5 + 10×50% + 0 + 0 = 15 min
  expect(billable(c, DEFAULT_SETTINGS)).toBe(15 * MIN)
})

test('without an activity signal, presence is inferred from the last prompt or turn', async () => {
  const blind = { ...session, hasPresence: false, present: [] }
  const c = classify(blind, DEFAULT_SETTINGS, 0, Infinity)
  expect(c.withYou).toBe(0) // more than 5 min after the prompt, presence is not assumed
  expect(c.alone).toBe(15 * MIN)
  expect(c.elsewhere).toBe(0)
})

test('rate turns billable hours into an amount per project', async () => {
  const s = { ...DEFAULT_SETTINGS, rates: { tokenkarma: 90 }, clients: { tokenkarma: 'Acme' } }
  const r = report([session], s, 'today', T0 + 60 * MIN)
  expect(r.projects[0]).toEqual({ project: 'tokenkarma', client: 'Acme', rate: 90, billableMs: 15 * MIN, amount: 22.5 })
  expect(r.amount).toBe(22.5)
})

test('periods start at local midnight, Monday, and the 1st', async () => {
  const thu = new Date(2026, 9, 15, 14, 30).getTime()
  expect(new Date(periodStart('today', thu)).getHours()).toBe(0)
  expect(new Date(periodStart('week', thu)).getDay()).toBe(1)
  expect(new Date(periodStart('month', thu)).getDate()).toBe(1)
})

test('presence samples merge into spans', async () => {
  let p = addPresence([], T0 + 30_000, 30_000)
  p = addPresence(p, T0 + 60_000, 30_000)
  p = addPresence(p, T0 + 5 * MIN, 30_000)
  expect(p).toEqual([[T0, T0 + 60_000], [T0 + 4.5 * MIN, T0 + 5 * MIN]])
})

test('the CSV has one row per project with hours per category', async () => {
  const s = { ...DEFAULT_SETTINGS, rates: { tokenkarma: 90 } }
  const r = report([session], s, 'today', T0 + 60 * MIN)
  const csv = toCsv(r, s, [session], T0 + 60 * MIN).split('\n')
  expect(csv[0]).toBe('"project","client","window_hours","withYou_hours","alone_hours","between_hours","elsewhere_hours","break_hours","billable_hours","rate","amount","currency"')
  expect(csv[1]).toBe('"tokenkarma","tokenkarma",0.08,0.08,0.17,0,0.08,0.08,0.25,90,22.5,"€"')
})

test('you near Claude between two prompts count as between', async () => {
  const near = { ...session, last: T0 + 24 * MIN, present: [[T0, T0 + 24 * MIN]] as [number, number][] }
  expect(classify(near, DEFAULT_SETTINGS, 0, Infinity).between).toBe(4 * MIN) // 9:20–9:24
})

test('a project or client name that looks like a formula is exported as text', async () => {
  const s = { ...DEFAULT_SETTINGS, clients: { tokenkarma: '=HYPERLINK("http://x")' } }
  const r = report([session], s, 'today', T0 + 60 * MIN)
  const row = toCsv(r, s, [session], T0 + 60 * MIN).split('\n')[1]
  expect(row?.startsWith('"tokenkarma","\'=HYPERLINK(""http://x"")"')).toBe(true)
})
