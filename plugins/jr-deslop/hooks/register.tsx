import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { PROSE, scan } from './rules'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-deslop'
const hits = atom({ plugin: 'jr-deslop', key: 'hits' } as const, [])
const commands = { isRegistered: false }

async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jr-deslop', description: 'Show AI-writing tells in the prose files written this session; /jr-deslop <file> scans one file' })
}

/** Scans one file and replaces its hits; returns how many it has. */
async function rescan($: EngineInterface, file: string) {
  let text: string
  try {
    text = await $.fs.read(file)
  } catch {
    return 0
  }
  const found = scan(file, text)
  await update($, hits, list => [...found, ...list.filter(hit => hit.file !== file)].slice(0, 500))
  return found.length
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!commands.isRegistered) {
      $.clock.after(0, () => {
        void ensureCommand($)
      })
    }
    return next(e)
  })

  // After Claude writes or edits a prose file, look it over. The file is never changed.
  on('tool.call', { tool: ['Write', 'Edit'] }, async ($, e, next) => {
    const ran = await next(e)
    const file = (e as unknown as { file_path?: string }).file_path
    if (!file || !PROSE.test(file) || ('deny' in ran && ran.deny) || ('isError' in ran && ran.isError)) return ran
    const count = await rescan($, file)
    if (count > 0) $.ui.toast(`jr deslop · ${count} AI-writing tell${count > 1 ? 's' : ''} in ${file.split('/').pop()} · /jr-deslop to see them`)
    return ran
  })

  on('command.run', { command: 'jr-deslop' }, async ($, e) => {
    const file = e.args.trim()
    if (file) {
      const count = await rescan($, file)
      if (count === 0) return { text: `jr deslop · no tells found in ${file}` }
    }
    await $.ui.open({ id: PANE, title: 'jr deslop', rows: 16 })
    const list = await read($, hits)
    return { text: `jr deslop · ${list.length} tell${list.length === 1 ? '' : 's'} listed` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, hits)
    const files = [...new Set(list.map(hit => hit.file))]
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'jr deslop', GRADIENTS.brand)}
          <Text dimColor>{`   ${list.length} tell${list.length === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'} · hints, not rules`}</Text>
        </Box>
        {list.length === 0 && <Text dimColor>No tells yet. Prose files Claude writes or edits are checked here.</Text>}
        {files.map(file => (
          <Box flexDirection="column">
            <Text bold color="#ffb86b">{file}</Text>
            {list
              .filter(hit => hit.file === file)
              .map(hit => (
                <Text wrap="truncate-end">
                  <Text color="#ff5ca8">{`  ${String(hit.line).padStart(4)}  `}</Text>
                  <Text color="#7f5af0">{hit.label.padEnd(24)}</Text>
                  <Text dimColor>{hit.excerpt}</Text>
                </Text>
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
