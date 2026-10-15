import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

const machine = (on: On, filled: string[], saved: Record<string, string> = {}) => {
  mock.store(on, saved)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/work/acme-site' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('prompt.fill', (_$, e) => {
    filled.push((e as unknown as { text: string }).text)
    return { isFilled: true, text: '', cursor: 0 } as never
  })
}

type Ui = {
  input: (a: object) => Promise<void>
  press: (a: object) => Promise<void>
  find: (q: object) => Promise<unknown>
  unmount: () => Promise<void>
}

test('type a draft, send it to the prompt box, and the scratch area empties', async ($, on) => {
  const filled: string[] = []
  machine(on, filled)
  await $.session.start({ cwd: '/work/acme-site', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrdraft', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    filled.length = 0
    const ui = (await $.ui.mount({ plugin: 'jr-draft', surface, component: 'Pane', requestId: 'jr-draft', props: {} } as never)) as never as Ui
    expect(await ui.find({ text: /acme-site/ } as never)).toBeDefined()
    await ui.input({ key: 'draft', text: 'then add tests for the parser', kind: 'change' })
    expect(await ui.find({ text: /6 words/ } as never)).toBeDefined()
    await ui.press({ key: 'send' })
    expect(filled).toEqual(['then add tests for the parser'])
    expect(await ui.find({ text: /0 words/ } as never)).toBeDefined()
    await ui.unmount()
  }
})

test('a draft saved in an earlier session comes back, and Clear empties it', async ($, on) => {
  machine(on, [], { 'draft:acme-site': 'remember this one' })
  await $.session.start({ cwd: '/work/acme-site', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'jrdraft', args: '' } as never)
  const ui = (await $.ui.mount({ plugin: 'jr-draft', surface: 'terminal', component: 'Pane', requestId: 'jr-draft', props: {} } as never)) as never as Ui
  expect(await ui.find({ text: /3 words/ } as never)).toBeDefined()
  await ui.press({ key: 'clear' })
  expect(await ui.find({ text: /0 words/ } as never)).toBeDefined()
})
