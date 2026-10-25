import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parseStats, size } from '../hooks/sysinfo'

const MAC = 'disk 971298980 121372424\nmem 33554432 5717744\nswap 23068672 22183485\ncpu 32\n'

test('the four lines parse into kilobytes and a percent', async () => {
  expect(parseStats(MAC)).toEqual({ diskTotal: 971298980, diskFree: 121372424, memTotal: 33554432, memAvailable: 5717744, swapTotal: 23068672, swapUsed: 22183485, cpu: 32 })
  // PowerShell writes CRLF.
  expect(parseStats(MAC.replaceAll('\n', '\r\n'))?.cpu).toBe(32)
})

test('a missing or broken line reads as nothing', async () => {
  expect(parseStats('os other\n')).toBeNull()
  expect(parseStats('disk 1 2\nmem 3 4\nswap 0 0\ncpu \n')).toBeNull()
})

test('sizes read short', async () => {
  expect([size(971298980), size(33554432), size(5717744), size(524288)]).toEqual(['926G', '32G', '5.5G', '512M'])
})

const machine = (on: On, out: Record<string, string>) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('env.get', (_$, e) => ({ value: (e as unknown as { name: string }).name === 'SystemRoot' && 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' in out ? 'C:\\Windows' : undefined }) as never)
  on('process.run', (_$, e) => {
    const cmd = (e as unknown as { argv: string[] }).argv[0]!
    if (!(cmd in out)) throw new Error(`${cmd}: not found`)
    return { value: { exitCode: 0, stdout: out[cmd], stderr: '' } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
}

const BAND = { plugin: 'jr-sysinfo', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 140 } } as const

test('macOS and Linux: /bin/sh reads the machine, the band shows the four figures', async ($, on) => {
  machine(on, { '/bin/sh': MAC })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount(BAND as never)
  expect(await band.find({ text: /disk/ } as never)).toBeDefined()
  expect(await band.find({ text: /116G\/926G free/ } as never)).toBeDefined()
  expect(await band.find({ text: /5\.5G\/32G free/ } as never)).toBeDefined()
  expect(await band.find({ text: /32%/ } as never)).toBeDefined()
  expect(await band.find({ text: /21\.2G\/22G used/ } as never)).toBeDefined()
  expect(await band.find({ text: /below/ } as never)).toBeDefined()
})

test('Windows: PowerShell by its full path, never sh', async ($, on) => {
  machine(on, { 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe': 'disk 1000000000 500000000\r\nmem 16000000 8000000\r\nswap 0 0\r\ncpu 7\r\n' })
  await $.session.start({ cwd: 'C:\\', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount(BAND as never)
  expect(await band.find({ text: /7%/ } as never)).toBeDefined()
  expect(await band.find({ text: /off/ } as never)).toBeDefined()
})

test('/jrsys toggles the band', async ($, on) => {
  machine(on, { '/bin/sh': MAC })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const shows = async () => {
    const band = await $.ui.mount(BAND as never)
    const seen = (await band.find({ text: /disk/ } as never)) !== undefined
    await band.unmount()
    return seen
  }
  expect(await shows()).toBe(true)
  expect(JSON.stringify(await $.command.run({ command: 'jrsys', args: '' } as never))).toContain('hidden')
  expect(await shows()).toBe(false)
  await $.command.run({ command: 'jrsys', args: 'show' } as never)
  expect(await shows()).toBe(true)
})
