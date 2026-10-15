import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { maskText, maskValue, parseMode } from '../hooks/mask'

// Fake credentials are assembled at run time, so no secret scanner mistakes this file for a leak.
const fake = (...parts: string[]) => parts.join('')
const STRIPE = fake('sk', '_live_', 'X'.repeat(24))
const GITHUB = fake('gh', 'p_', 'a1B2'.repeat(9))
const AWS = fake('AK', 'IA', 'Q'.repeat(16))

test('keys, emails, money, phone numbers and IPs are masked', async () => {
  expect(maskText(`token ${STRIPE} end`, 'on')).toBe('token █████ end')
  expect(maskText(`push with ${GITHUB}`, 'on')).toBe('push with █████')
  expect(maskText(`id ${AWS}`, 'on')).toBe('id █████')
  expect(maskText('API_KEY=abc123', 'on')).toBe('API_KEY=█████')
  expect(maskText('write to jane@acme.io', 'on')).toBe('write to █████')
  expect(maskText('invoice of 4 200 € paid', 'on')).toBe('invoice of █████ paid')
  expect(maskText('call +33 6 12 34 56 78 now', 'on')).toBe('call █████ now')
  expect(maskText('server 10.0.12.7 is up', 'on')).toBe('server █████ is up')
})

test('strict also hides home paths and long numbers; off shows everything', async () => {
  expect(maskText('/Users/alex/Code/app order 834512', 'strict')).toBe('/Users/█/Code/app order █████')
  expect(maskText('/Users/alex/Code/app order 834512', 'on')).toBe('/Users/alex/Code/app order 834512')
  expect(maskText(`token ${STRIPE}`, 'off')).toBe(`token ${STRIPE}`)
})

test('tool inputs and outputs keep their shape', async () => {
  expect(maskValue({ command: 'curl -H "x" jane@acme.io', n: 3, list: ['a@b.co'] }, 'on')).toEqual({ command: 'curl -H "x" █████', n: 3, list: ['█████'] })
})

test('/jrrec alone toggles, words pick a mode, anything else is refused', async () => {
  expect(parseMode('', 'off')).toBe('on')
  expect(parseMode('', 'strict')).toBe('off')
  expect(parseMode('strict', 'off')).toBe('strict')
  expect(parseMode('maybe', 'off')).toBe(null)
})

const machine = (on: On) => {
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{(e.props as { text: string }).text}</Text>
  })
}

test('on screen only: an assistant reply is masked while recording, and the band says so', async ($, on) => {
  machine(on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrrec', args: 'on' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const reply = await $.ui.mount({
      plugin: 'jr-record',
      surface,
      component: 'AssistantMessage',
      props: { text: 'Sent the invoice to jane@acme.io', isFirstOfReply: true },
    } as never)
    const drawn = JSON.stringify(await reply.drawn())
    expect(drawn).toContain('█████')
    expect(drawn).not.toContain('jane@acme.io')
    await reply.unmount()
    const band = await $.ui.mount({ plugin: 'jr-record', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80 } } as never)
    expect(await band.find({ text: /REC/ } as never)).toBeDefined()
    await band.unmount()
  }
})
