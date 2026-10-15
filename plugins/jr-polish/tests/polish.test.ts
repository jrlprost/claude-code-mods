import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { cleanReply } from '../hooks/polish'

test('the reply is cleaned of fences and quotes', async () => {
  expect(cleanReply('```\nFix the login bug.\n```')).toBe('Fix the login bug.')
  expect(cleanReply('"Fix the login bug."')).toBe('Fix the login bug.')
})

const machine = (on: On, asked: { model?: string; prompt?: string }[], filled: string[], answer: object) => {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('model.complete', (_$, e) => {
    asked.push(e as never)
    return { value: answer } as never
  })
  on('prompt.fill', (_$, e) => {
    filled.push((e as unknown as { text: string }).text)
    return { isFilled: true, text: '', cursor: 0 } as never
  })
}

test('/jrpolish rewrites with the small model and fills the prompt box', async ($, on) => {
  const asked: { model?: string; prompt?: string }[] = []
  const filled: string[] = []
  machine(on, asked, filled, { isAnswered: true, text: 'Fix the login bug in auth.ts.\n- keep the API unchanged', usage: {} })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ command: 'jrpolish', args: 'euh fix the login bug in auth ts keep the api' } as never)
  expect(asked[0]?.model).toBe('haiku')
  expect(asked[0]?.prompt).toBe('euh fix the login bug in auth ts keep the api')
  expect(filled).toEqual(['Fix the login bug in auth.ts.\n- keep the API unchanged'])
  expect(JSON.stringify(out)).toContain('before:')
})

test('no answer: the prompt box is left alone', async ($, on) => {
  const filled: string[] = []
  machine(on, [], filled, { isAnswered: false, reason: 'empty-reply', usage: {} })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ command: 'jrpolish', args: 'something' } as never)
  expect(filled).toEqual([])
  expect(JSON.stringify(out)).toContain('unchanged')
})

test('empty argument shows the usage', async ($, on) => {
  machine(on, [], [], { isAnswered: true, text: 'x', usage: {} })
  const out = await $.command.run({ command: 'jrpolish', args: '  ' } as never)
  expect(JSON.stringify(out)).toContain('usage')
})
