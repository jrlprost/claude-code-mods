import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { message, shouldPing, soundFile, spoken } from '../hooks/ping'

test('durations read naturally', async () => {
  expect(spoken(42_000)).toBe('42 s')
  expect(spoken(252_000)).toBe('4 min 12 s')
  expect(spoken(3_900_000)).toBe('1 h 05 min')
})

test('only long, finished, main-loop turns ping', async () => {
  expect(shouldPing({ durationMs: 200_000, isAborted: false }, 120)).toBe(true)
  expect(shouldPing({ durationMs: 60_000, isAborted: false }, 120)).toBe(false)
  expect(shouldPing({ durationMs: 200_000, isAborted: true }, 120)).toBe(false)
  expect(shouldPing({ durationMs: 200_000, isAborted: false, agentId: 'a1' }, 120)).toBe(false)
})

test('errors say so; sounds map to system files', async () => {
  expect(message('shop', { durationMs: 130_000, isAborted: false, reason: 'error' })).toBe('shop: stopped on an error after 2 min 10 s')
  expect(soundFile('Glass')).toBe('/System/Library/Sounds/Glass.aiff')
  expect(soundFile('none')).toBe(null)
})

const machine = (on: On, notes: string[], played: string[][]) => {
  on('session.root', () => ({ value: '/work/shop' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.notify', ($, e) => {
    notes.push(String((e as unknown as { text: string }).text))
    return { value: { isSent: true, channel: 'terminal' } } as never
  })
  on('process.run', ($, e) => {
    played.push((e as unknown as { argv: string[] }).argv)
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
}

test('a long turn notifies with the project and plays the sound', async ($, on) => {
  const notes: string[] = []
  const played: string[][] = []
  machine(on, notes, played)
  await $.turn.complete({ answer: '', durationMs: 252_000, isAborted: false, turnId: 't', text: '', reason: 'answer' } as never)
  await $.turn.complete({ answer: '', durationMs: 10_000, isAborted: false, turnId: 't2', text: '', reason: 'answer' } as never)
  expect(notes).toEqual(['shop: done in 4 min 12 s'])
  expect(played).toEqual([['afplay', '/System/Library/Sounds/Glass.aiff']])
})
