import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { isBrokenPromise } from '../hooks/promise'

test('announcements in English and French are caught', async () => {
  expect(isBrokenPromise("Got it. I'll update the README and push.")).toBe(true)
  expect(isBrokenPromise('Let me fix the failing test.')).toBe(true)
  expect(isBrokenPromise('Done with the parser.\n\nNext: wire the CLI.')).toBe(true)
  expect(isBrokenPromise("C'est noté. Je lance la migration.")).toBe(true)
  expect(isBrokenPromise('Je vais corriger le bandeau maintenant.')).toBe(true)
})

test('plans, questions and explanations are left alone', async () => {
  expect(isBrokenPromise("I'll deploy it once you confirm. Shall I go ahead?")).toBe(false)
  expect(isBrokenPromise('## Plan\n1. Migrate\n2. Deploy')).toBe(false)
  expect(isBrokenPromise('Je lance ?')).toBe(false)
  expect(isBrokenPromise('Let me explain how the cache works: it keeps five minutes.')).toBe(false)
  expect(isBrokenPromise('The tests pass and the page is live.')).toBe(false)
})

const machine = (on: On) => {
  on('turn.start', () => ({ turnId: 't1' }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('classic.Stop', () => ({}))
  on('ui.toast', () => ({ value: undefined }) as never)
}

const stop = (text: string, active = false) => ({ stop_hook_active: active, last_assistant_message: text }) as never

test('a reply that only announces work is sent back once', async ($, on) => {
  machine(on)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  const first = await $.classic.Stop(stop("I'll write the migration now."))
  expect(first.block).toContain('announces work')
  const second = await $.classic.Stop(stop("I'll write the migration now.", true))
  expect(second.block).toBeUndefined()
})

test('a turn that ran tools is not judged', async ($, on) => {
  machine(on)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  const r = await $.classic.Stop(stop("Next: I'll push it."))
  expect(r.block).toBeUndefined()
})
