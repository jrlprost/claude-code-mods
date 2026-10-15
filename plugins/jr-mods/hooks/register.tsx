import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrModsApply } from '../types'
import { changesOf, itemsOf, kindOf, summary } from './plugins'

const PANE = 'jr-mods'
const items = atom({ plugin: 'jr-mods', key: 'items' } as const, [])

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
    await $.command.register({ name: 'jrmods', description: 'Turn plugins and mods on or off: space ticks, enter applies' })
    return next(e)
  })

  on('command.run', { command: 'jrmods' }, async $ => {
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
    if (!Client) return <Text>Open /jrmods in the terminal or the desktop app to toggle plugins.</Text>
    return <Client key="list" module="./list.client.tsx" props={{ items: list }} height="100%" flexGrow={1} />
  })
}
