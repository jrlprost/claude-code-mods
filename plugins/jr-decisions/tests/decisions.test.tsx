import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { decisionInPrompt, toMarkdown } from '../hooks/journal'

test('a prompt starting with decision: (or décision :) is a decision', async () => {
  expect(decisionInPrompt('decision: we keep Postgres')).toBe('we keep Postgres')
  expect(decisionInPrompt('Décision : on garde Stripe')).toBe('on garde Stripe')
  expect(decisionInPrompt('what decision should we take?')).toBe(null)
})

test('the export is ADR-lite, numbered, oldest first', async () => {
  const md = toMarkdown('shop', [
    { at: new Date(2026, 9, 16).getTime(), text: 'Use Stripe Checkout. Less code to own.', source: 'command' },
    { at: new Date(2026, 9, 15).getTime(), text: 'Keep Postgres', source: 'prompt' },
  ])
  expect(md).toContain('# Decisions: shop')
  expect(md.indexOf('001. Keep Postgres')).toBeLessThan(md.indexOf('002. Use Stripe Checkout'))
  expect(md).toContain('Less code to own.')
})

const machine = (on: On, written: Record<string, string>, toasts: string[], links: Record<string, string> = {}) => {
  mock.clock(on)
  mock.store(on)
  on('session.root', () => ({ value: '/work/shop' }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', ($, e) => {
    toasts.push(String((e as unknown as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('fs.write', ($, e) => {
    const w = e as unknown as { path: string; text: string }
    written[w.path] = w.text
    return { value: undefined } as never
  })
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  // Folder listings, links not followed: the project holds docs/ only where a test plants a link.
  on('fs.list', ($, e) => {
    const dir = (e as unknown as { path?: string }).path ?? ''
    if (dir === '/work/shop' && links['/work/shop/docs']) return { value: [{ name: 'docs', kind: 'other', size: 0, mtimeMs: 0, isLink: true }] } as never
    if (dir === '/work/shop') return { value: [{ name: 'README.md', kind: 'file', size: 10, mtimeMs: 0, isLink: false }] } as never
    return { value: [] } as never
  })
}

test('commands and prompts fill the journal, the pane lists it newest first, export writes the file', async ($, on) => {
  const written: Record<string, string> = {}
  machine(on, written, [])
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jr-decisions', args: 'Keep Postgres' } as never)
  await $.prompt.submit({ text: 'decision: ship on Fridays never', origin: { kind: 'composer' }, wait: false } as never)
  await $.command.run({ command: 'jr-decisions', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-decisions', surface, component: 'Pane', requestId: 'jr-decisions', props: {} } as never)
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn.indexOf('ship on Fridays never')).toBeLessThan(drawn.indexOf('Keep Postgres'))
    await ui.unmount()
  }
  const out = await $.command.run({ command: 'jr-decisions', args: 'export' } as never)
  expect(JSON.stringify(out)).toContain('2 written to /work/shop/docs/decisions.md')
  expect(Object.keys(written)).toEqual(['/work/shop/docs/decisions.md'])
})

test('export refuses when docs/ is a link pointing out of the project', async ($, on) => {
  const written: Record<string, string> = {}
  machine(on, written, [], { '/work/shop/docs': '/Users/someone' })
  await $.session.start({ cwd: '/work/shop', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jr-decisions', args: 'Keep Postgres' } as never)
  const out = await $.command.run({ command: 'jr-decisions', args: 'export' } as never)
  expect(JSON.stringify(out)).toContain('not written')
  expect(Object.keys(written)).toEqual([])
})
