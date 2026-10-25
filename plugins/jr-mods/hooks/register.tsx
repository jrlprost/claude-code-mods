import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrModsApply } from '../types'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { changesOf, itemsOf, kindOf, summary } from './plugins'
import { BILLING, GROUP_TITLES, RULE, enabledNames, welcomeOf } from './welcome'

const PANE = 'jr-mods'
const WELCOME = 'jr-mods-welcome'
const items = atom({ plugin: 'jr-mods', key: 'items' } as const, [])
const installed = atom({ plugin: 'jr-mods', key: 'installed' } as const, [])

/** Opens the welcome pane listing the installed jr mods; false when plugins could not be listed. */
async function openWelcome($: EngineInterface) {
  const { exitCode, stdout } = await $.process.run(['claude', 'plugin', 'list', '--json'])
  if (exitCode !== 0) return false
  const names = enabledNames(JSON.parse(stdout) as { id: string; enabled: boolean }[])
  await update($, installed, () => names)
  const rows = welcomeOf(names).reduce((n, g) => n + g.entries.length + 2, 0) + (names.includes('jr-time') ? BILLING.length : 0)
  await $.ui.open({ id: WELCOME, title: 'jr mods · welcome', closeOnEscape: true, rows: Math.min(rows + 4, 40) })
  return true
}

/** The first session after install shows the welcome once; the flag is set before the one attempt. */
async function onboard($: EngineInterface) {
  if ((await $.store.get('isOnboarded')) === true) return
  await $.store.set('isOnboarded', true)
  try {
    await openWelcome($)
  } catch {
    // One attempt only: /jr-mods welcome opens it again.
  }
}

async function loadItems($: EngineInterface) {
  const { exitCode, stdout } = await $.process.run(['claude', 'plugin', 'list', '--json'])
  if (exitCode !== 0) return false
  const listed = JSON.parse(stdout) as { id: string; enabled: boolean; installPath?: string }[]
  const descriptions: Record<string, string> = {}
  const kinds: Record<string, 'mod' | 'plugin'> = {}
  for (const row of listed) {
    if (!row.installPath) continue
    try {
      const manifest = JSON.parse(await $.fs.read(`${row.installPath}/.claude-plugin/plugin.json`)) as { description?: string }
      if (manifest.description) descriptions[row.id] = manifest.description
    } catch {
      // A plugin without a readable manifest is listed by name alone.
    }
    try {
      kinds[row.id] = kindOf(await $.fs.read(`${row.installPath}/hooks/hooks.json`))
    } catch {
      kinds[row.id] = 'plugin'
    }
  }
  await update($, items, () => itemsOf(listed, descriptions, kinds))
  return true
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'jr-mods', description: 'Turn plugins and mods on or off: space ticks, enter applies. /jr-mods welcome: what each jr mod shows' })
    const started = await next(e)
    $.clock.after(0, () => {
      void onboard($)
    })
    return started
  })

  on('command.run', { command: 'jr-mods' }, async ($, e) => {
    if (e.args.trim() === 'welcome') {
      if (!(await openWelcome($))) return { text: 'jr-mods: could not list plugins (claude plugin list failed).' }
      return { text: 'jr-mods: welcome opened.' }
    }
    if (!(await loadItems($))) return { text: 'jr-mods: could not list plugins (claude plugin list failed).' }
    // Tall enough for the longer tab, the tab line and the footer.
    const list = await read($, items)
    const longest = Math.max(...(['mod', 'plugin'] as const).map(kind => list.filter(i => i.kind === kind).length))
    await $.ui.open({ id: PANE, title: 'jr mods', focus: true, closeOnEscape: true, rows: Math.min(longest + 3, 40) })
    // Hand the keys straight to the list, so no click is needed before space and arrows work.
    try {
      const focused = await $.ui.focus({ requestId: PANE, key: 'list' })
      if (focused && 'deny' in focused && focused.deny) $.ui.toast(`jr mods · click the list once to use the keys (${focused.deny})`)
    } catch (error) {
      $.ui.toast(`jr mods · click the list once to use the keys (${String(error).slice(0, 80)})`)
    }
    return { text: 'jr-mods opened: space ticks, enter applies.' }
  })

  // Enter in the list: apply every change in one go.
  on('ui.message', { requestId: PANE }, async ($, e) => {
    const data = e.data as JrModsApply
    if (data?.type !== 'apply') return {}
    const changes = changesOf(await read($, items), data.wanted)
    const done = []
    for (const change of changes) {
      const { exitCode } = await $.process.run(['claude', 'plugin', change.enable ? 'enable' : 'disable', change.id])
      done.push({ ...change, ok: exitCode === 0 })
    }
    await $.ui.close({ id: PANE })
    $.ui.toast(changes.length ? `jr mods · ${summary(done)} · /reload-plugins to apply now` : 'jr mods · nothing changed')
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Client } = $.ui.resolve(e) as unknown as { Client?: (p: Record<string, unknown>) => never }
    const { Text } = $.ui.resolve(e)
    const list = await read($, items)
    if (!Client) return <Text>Open /jr-mods in the terminal or the desktop app to toggle plugins.</Text>
    return <Client key="list" module="./list.client.tsx" props={{ items: list }} height="100%" flexGrow={1} />
  })

  on('ui.render', { component: 'Pane', requestId: WELCOME }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const names = await read($, installed)
    const groups = welcomeOf(names)
    return (
      <Box flexDirection="column">
        <Text>{gradientText(Text, 'jr mods', GRADIENTS.brand)}<Text dimColor>{'  what each mod shows, and how to hide it'}</Text></Text>
        {groups.length === 0 && <Text dimColor>No jr mod with a band is installed.</Text>}
        {groups.map(g => (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{GROUP_TITLES[g.group]}</Text>
            {g.entries.map(entry => (
              <Box flexDirection="column">
                <Text wrap="truncate-end">
                  <Text color="#ff5ca8">{`  ${entry.command.padEnd(15)}`}</Text>
                  <Text dimColor>{entry.what}</Text>
                </Text>
                {entry.name === 'jr-time' &&
                  BILLING.map(line => (
                    <Text wrap="truncate-end" dimColor>{`  ${''.padEnd(15)}${line}`}</Text>
                  ))}
              </Box>
            ))}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor wrap="wrap">{RULE}</Text>
        </Box>
      </Box>
    )
  })
}
