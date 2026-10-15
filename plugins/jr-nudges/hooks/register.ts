import type { EngineInterface, Register } from 'claude-code'

import { countChange, isCode, message } from './nudges'

// The main loop's current turn: each code file written so far, with its text before the turn touched it.
const turn = { files: new Map<string, string>() }

const touchedPath = (tool: string, input: Record<string, unknown>) =>
  tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' ? (typeof input.file_path === 'string' ? input.file_path : null) : null

/** Debug statements and markers the turn added: each file now, against its text before the turn. */
async function countTurn($: EngineInterface) {
  let debug = 0
  let markers = 0
  for (const [file, before] of turn.files) {
    const counts = countChange(before, await $.fs.read(file).catch(() => before))
    debug += counts.debug
    markers += counts.markers
  }
  return { debug, markers }
}

/** The file's text before this turn first touched it: empty for a new file. */
async function snapshot($: EngineInterface, file: string) {
  return (await $.fs.exists(file).catch(() => false)) ? await $.fs.read(file).catch(() => '') : ''
}

export const register: Register = on => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) turn.files = new Map()
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const file = touchedPath(String(e.tool), e as unknown as Record<string, unknown>)
    if (!file || !isCode(file)) return next(e)
    const before = turn.files.get(file) ?? (await snapshot($, file))
    const ran = await next(e)
    if (!ran.isError && ran.deny === undefined && !turn.files.has(file)) turn.files.set(file, before)
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || turn.files.size === 0) return done
    const { debug, markers } = await countTurn($)
    const text = message(debug, markers)
    if (text) $.ui.toast(text)
    return done
  })
}
