import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { DEFAULT_DICTIONARY, literalPattern, parsePairs } from '../hooks/dictionary'
import { normalize } from '../hooks/normalize'

test('fixes mishears and keeps the rest', async () => {
  const r = normalize('open the cloud md in cloud code and check the package json', DEFAULT_DICTIONARY)
  expect(r?.corrected).toBe('open the CLAUDE.md in Claude Code and check the package.json')
  expect(r?.segments.filter(s => s.kind === 'added').length).toBe(3)
})

test('leaves correct text alone', async () => {
  expect(normalize('deploy to Google Cloud with TypeScript and GitHub', DEFAULT_DICTIONARY)).toBe(null)
})

test('matches whole words only, accents included', async () => {
  expect(normalize('apiculture, éapi, capi', DEFAULT_DICTIONARY)).toBe(null)
  expect(normalize('déploie avec type script', DEFAULT_DICTIONARY)?.corrected).toBe('déploie avec TypeScript')
})

test('settings pairs and literal patterns', async () => {
  expect(parsePairs('acme corp => ACME; my app=>MyApp\nbad')).toEqual([['acme corp', 'ACME'], ['my app', 'MyApp']])
  expect(normalize('ship acme corp today', [[literalPattern('acme corp'), 'ACME']])?.corrected).toBe('ship ACME today')
  expect(normalize('price is 5$ (sale)', [[literalPattern('5$ (sale)'), 'five']])?.corrected).toBe('price is five')
})

test('a broken pattern is skipped, not fatal', async () => {
  expect(normalize('cloud code', [['(', 'x'], ['cloud code', 'Claude Code']])?.corrected).toBe('Claude Code')
})

const machine = (on: On, seen: string[]) => {
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('prompt.submit', (_$, e) => {
    seen.push(e.text)
    return { text: e.text } as never
  })
}

test('the model reads the corrected prompt, and taught words apply', async ($, on) => {
  const seen: string[] = []
  machine(on, seen)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'run the cloud code tests', origin: { kind: 'composer' }, wait: false } as never)
  const taught = await $.command.run({ command: 'jrdict', args: 'add acme corp => ACME' } as never)
  expect(JSON.stringify(taught)).toContain('learned')
  await $.prompt.submit({ text: 'email acme corp', origin: { kind: 'composer' }, wait: false } as never)
  expect(seen).toEqual(['run the Claude Code tests', 'email ACME'])
  const listed = await $.command.run({ command: 'jrdict', args: 'list' } as never)
  expect(JSON.stringify(listed)).toContain('acme corp')
})

test('the prompt row shows the diff on terminal and desktop', async ($, on) => {
  machine(on, [])
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  await $.prompt.submit({ text: 'fix cloud code', origin: { kind: 'composer' }, wait: false } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'jr-dictation',
      surface,
      component: 'UserMessage',
      props: { text: 'fix Claude Code', origin: { kind: 'composer' }, isExpanded: false },
    } as never)
    expect(await ui.find({ text: /cloud code/ } as never)).toBeDefined()
    expect(await ui.find({ text: /1 correction/ } as never)).toBeDefined()
    await ui.unmount()
  }
})
