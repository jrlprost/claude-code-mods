import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { claims, isVerifying } from '../hooks/claims'

test('claims of verification, in English and French', async () => {
  expect(claims('Fixed the parser. All tests pass now.')).toEqual(['All tests pass now.'])
  expect(claims("J'ai corrigé le bug, c'est testé et ça marche.")).toHaveLength(1)
  expect(claims('Verified on the staging page.')).toHaveLength(1)
})

test('negated claims are not claims', async () => {
  expect(claims("I couldn't verify it without a key.")).toEqual([])
  expect(claims('Not tested yet.')).toEqual([])
  expect(claims("Je n'ai pas testé.")).toEqual([])
  expect(claims('Updated the README.')).toEqual([])
})

test('what counts as a check', async () => {
  expect(isVerifying('Bash')).toBe(true)
  expect(isVerifying('mcp__playwright__browser_take_screenshot')).toBe(true)
  expect(isVerifying('Edit')).toBe(false)
})

const machine = (on: On, toasts: string[]) => {
  on('turn.start', () => ({ turnId: 't1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
}

const ANSWER = 'I updated the checkout. Tested, it works now.'
const END = { answer: ANSWER, durationMs: 1, isAborted: false, turnId: 't1', text: ANSWER, reason: 'answer' }
const MESSAGE = { component: 'AssistantMessage', props: { text: ANSWER, isFirstOfReply: true } } as const

test('a claim with nothing run gets a toast and a warning under the message', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts)
  await $.turn.start({ text: 'fix checkout', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete(END as never)
  expect(toasts.length).toBe(1)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-done-check', surface, ...MESSAGE } as never)
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('nothing was run in this turn')
    expect(drawn).toContain('I updated the checkout')
    await ui.unmount()
  }
})

test('a claim backed by a command in the turn passes silently', async ($, on) => {
  const toasts: string[] = []
  machine(on, toasts)
  await $.turn.start({ text: 'fix checkout', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.turn.complete(END as never)
  expect(toasts).toEqual([])
  const ui = await $.ui.mount({ plugin: 'jr-done-check', surface: 'terminal', ...MESSAGE } as never)
  expect(JSON.stringify(await ui.drawn())).not.toContain('nothing was run')
})
