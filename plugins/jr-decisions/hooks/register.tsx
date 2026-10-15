import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrDecision } from '../types'
import { day, decisionInPrompt, toMarkdown } from './journal'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-decisions'
const decisions = atom({ plugin: 'jr-decisions', key: 'decisions' } as const, [])
const project = atom({ plugin: 'jr-decisions', key: 'project' } as const, '')
const live = { isLoaded: false, root: '' }

/** Loads this project's journal once: at session start, or at the first event after a mid-session install. */
async function ensureLoaded($: EngineInterface) {
  if (live.isLoaded) return
  live.isLoaded = true
  live.root = await $.session.root()
  const saved = (await $.store.get(`decisions:${live.root}`)) as JrDecision[] | undefined
  await update($, decisions, () => saved ?? [])
  await update($, project, () => live.root.split('/').pop() || live.root)
}

async function add($: EngineInterface, text: string, source: JrDecision['source']) {
  await ensureLoaded($)
  const at = await $.clock.now()
  const next = [...(await read($, decisions)), { at, text, source }]
  await $.store.set(`decisions:${live.root}`, next)
  await update($, decisions, () => next)
  return next.length
}

/** The real path of `path`, or null when it does not exist yet. */
async function realPathOf($: EngineInterface, path: string) {
  try {
    const stat = await $.fs.stat(path, { resolve: true })
    return { isLink: stat.isLink, real: stat.realPath ?? path }
  } catch {
    return null
  }
}

/**
 * Writes docs/decisions.md only where it really lies inside the project: a repository could
 * make docs/ or the file a symbolic link pointing anywhere on the machine, and the write would follow it.
 */
async function exportJournal($: EngineInterface) {
  await ensureLoaded($)
  const list = await read($, decisions)
  const target = `${live.root}/docs/decisions.md`
  const root = (await realPathOf($, live.root))?.real ?? live.root
  for (const path of [`${live.root}/docs`, target]) {
    const found = await realPathOf($, path)
    if (found && (found.isLink || !found.real.startsWith(`${root}/`))) {
      return { target, count: list.length, refused: `${path} is a link or lies outside the project` }
    }
  }
  await $.fs.write(target, toMarkdown(await read($, project), list))
  return { target, count: list.length, refused: undefined }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jrdecide', description: 'Record a decision for this project: /jrdecide <decision>' })
    await $.command.register({ name: 'jrdecisions', description: 'Decision journal: open it, or /jrdecisions export to docs/decisions.md' })
    await ensureLoaded($)
    return started
  })

  on('command.run', { command: 'jrdecide' }, async ($, e) => {
    const text = e.args.trim()
    if (!text) return { text: 'jr decisions · usage: /jrdecide <decision>' }
    const n = await add($, text, 'command')
    return { text: `jr decisions · #${n} recorded` }
  })

  on('command.run', { command: 'jrdecisions' }, async ($, e) => {
    await ensureLoaded($)
    if (e.args.trim() === 'export') {
      const { target, count, refused } = await exportJournal($)
      if (refused) return { text: `jr decisions · not written: ${refused}` }
      return { text: `jr decisions · ${count} written to ${target}` }
    }
    const count = (await read($, decisions)).length
    await $.ui.open({ id: PANE, title: 'jr decisions', rows: Math.min(count + 3, 30) })
    return { text: `jr decisions · ${count} in this project` }
  })

  // "decision: we keep Postgres" in a prompt is recorded, and the prompt still goes to Claude.
  on('prompt.submit', async ($, e, next) => {
    const text = e.command || e.isMeta ? null : decisionInPrompt(e.text)
    if (text) {
      const n = await add($, text, 'prompt')
      $.ui.toast(`jr decisions · #${n} recorded`)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = [...(await read($, decisions))].reverse()
    const name = await read($, project)
    return (
      <Box flexDirection="column">
        <Text>
          {gradientText(Text, 'jr decisions', GRADIENTS.brand)}
          <Text dimColor>{`  ${name} · ${list.length}`}</Text>
        </Text>
        {list.length === 0 && <Text dimColor>No decisions yet. /jrdecide &lt;decision&gt;, or start a prompt with "decision:".</Text>}
        {list.map((d, i) => (
          <Text wrap="truncate-end">
            <Text color="#ff5ca8" bold>{`#${list.length - i} `.padStart(5)}</Text>
            <Text dimColor>{`${day(d.at)}  `}</Text>
            <Text>{d.text}</Text>
          </Text>
        ))}
        <Text dimColor>/jrdecisions export writes docs/decisions.md</Text>
      </Box>
    )
  })
}
