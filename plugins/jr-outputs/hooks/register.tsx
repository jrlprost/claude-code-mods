import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrOutput } from '../types'
import { parseNumstat, record, relative, touchedPath } from './outputs'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { repoIsSafe, safeGit } from './jr/git'

const PANE = 'jr-outputs'
const outputs = atom({ plugin: 'jr-outputs', key: 'outputs' } as const, [])
const root = atom({ plugin: 'jr-outputs', key: 'root' } as const, '')

async function ensureRoot($: EngineInterface) {
  if (!(await read($, root))) {
    const dir = await $.session.root()
    await update($, root, () => dir)
  }
  return read($, root)
}

/** Fills in +/- line counts from git for the listed files; created files outside git count their lines. */
async function withLineCounts($: EngineInterface) {
  const dir = await ensureRoot($)
  const list = await read($, outputs)
  // A repo whose config or attributes could make git run a program gets no git counts.
  const diff = (await repoIsSafe($, dir))
    ? await $.process.run(safeGit(['-C', dir, 'diff', '--numstat', 'HEAD', '--', ...list.map(o => o.path)])).catch(() => null)
    : null
  const counts = diff && diff.exitCode === 0 ? parseNumstat(diff.stdout) : new Map<string, [number, number]>()
  const counted: JrOutput[] = []
  for (const o of list) {
    let pair = counts.get(relative(dir, o.path))
    if (!pair && o.isCreated) {
      const text = await $.fs.read(o.path).catch(() => '')
      pair = [text ? text.split('\n').length : 0, 0]
    }
    counted.push(pair ? { ...o, added: pair[0], removed: pair[1] } : o)
  }
  await update($, outputs, () => counted)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jr-outputs', description: 'Files this session created or changed, newest first' })
    await ensureRoot($)
    return started
  })

  on('tool.call', async ($, e, next) => {
    const file = touchedPath(String(e.tool), e as unknown as Record<string, unknown>)
    if (!file) return next(e)
    const existed = await $.fs.exists(file).catch(() => true)
    const ran = await next(e)
    if (!ran.isError && ran.deny === undefined) {
      const at = await $.clock.now()
      await update($, outputs, list => record(list ?? [], file, existed, at))
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'jr-outputs' }, async $ => {
    await withLineCounts($)
    const count = (await read($, outputs)).length
    await $.ui.open({ id: PANE, title: 'jr outputs', rows: Math.min(count + 3, 30) })
    return { text: `jr outputs · ${count} file${count === 1 ? '' : 's'} this session` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, outputs)
    const dir = await read($, root)
    const width = Math.min(Math.max(26, ...list.map(o => relative(dir, o.path).length)), 60) + 2
    return (
      <Box flexDirection="column">
        <Text>
          {gradientText(Text, 'jr outputs', GRADIENTS.brand)}
          <Text dimColor>{`  ${list.filter(o => o.isCreated).length} created · ${list.filter(o => !o.isCreated).length} changed`}</Text>
        </Text>
        {list.length === 0 && <Text dimColor>Nothing written yet in this session.</Text>}
        {list.map(o => (
          <Text wrap="truncate-start">
            <Text color={o.isCreated ? '#2cb67d' : '#ffb86b'} bold>{o.isCreated ? ' + ' : ' ~ '}</Text>
            <Text>{relative(dir, o.path).padEnd(width)}</Text>
            {o.added !== undefined && <Text color="#2cb67d">{` +${o.added}`}</Text>}
            {o.removed !== undefined && <Text color="#ef4565">{` -${o.removed}`}</Text>}
            {o.edits > 1 && <Text dimColor>{`  ×${o.edits}`}</Text>}
          </Text>
        ))}
        <Text dimColor>+ created · ~ changed · counts from git when the project is a repository</Text>
      </Box>
    )
  })
}
