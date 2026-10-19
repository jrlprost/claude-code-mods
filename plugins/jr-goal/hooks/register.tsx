import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrGoal } from '../types'
import { applyCommand, progress } from './goal'
import { gauge } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const goal = atom({ plugin: 'jr-goal', key: 'goal' } as const, null)
const bandHidden = atom({ plugin: 'jr-goal', key: 'isBandHidden' } as const, false)

const bandState = { isLoaded: false }

/** True while the band is hidden; the saved choice is read once per load of the mod. */
async function isBandHidden($: EngineInterface) {
  if (!bandState.isLoaded) {
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
    bandState.isLoaded = true
  }
  return read($, bandHidden)
}

/** Hides or shows the band for every session, kept across restarts. */
async function setBand($: EngineInterface, hide: boolean, name: string, command: string) {
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? `${name} · hidden (${command} to bring it back)` : `${name} · shown` }
}
const live = { isLoaded: false, project: '' }

async function projectKey($: EngineInterface) {
  const root = await $.session.root()
  return `goal:${root}`
}

/** Loads this project's goal into the drawing state, once. */
async function ensureLoaded($: EngineInterface) {
  if (live.isLoaded) return
  live.isLoaded = true
  live.project = await projectKey($)
  const saved = (await $.store.get(live.project)) as JrGoal | undefined
  await update($, goal, () => saved ?? null)
}

export const register: Register = (on, options) => {
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await isBandHidden($)
    await $.command.register({ name: 'jrgoal', description: 'Project goal and steps: /jrgoal <goal>, step <text>, done <n>, clear, hide, show' })
    await ensureLoaded($)
    return started
  })

  on('command.run', { command: 'jrgoal' }, async ($, e) => {
    await ensureLoaded($)
    const word = e.args.trim().toLowerCase()
    if (word === 'hide' || word === 'show') return setBand($, word === 'hide', 'jr goal band', '/jrgoal show')
    const result = applyCommand(await read($, goal), e.args, await $.clock.now())
    if (result.goal) await $.store.set(live.project, result.goal)
    else await $.store.delete(live.project)
    await update($, goal, () => result.goal)
    return { text: result.text }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (!live.isLoaded) {
      $.clock.after(0, () => {
        void ensureLoaded($)
      })
    }
    if (await read($, bandHidden)) return below
    const g = await read($, goal)
    if (!showBand || !g || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    const done = g.steps.filter(s => s.isDone).length
    const ratio = g.steps.length ? done / g.steps.length : 0
    const upcoming = g.steps.find(s => !s.isDone)
    return (
      <Box flexDirection="column">
        <Box justifyContent="flex-end">
          <Text wrap="truncate-end">
            <Text dimColor>{'goal '}</Text>
            <Text>{g.goal}</Text>
            {g.steps.length > 0 && (
              <Text>
                <Text>{' '}</Text>
                {gauge(Text, ratio, 6, GRADIENTS.money)}
                <Text>{` ${progress(g)}`}</Text>
              </Text>
            )}
            {upcoming && <Text dimColor>{` · next: ${upcoming.text}`}</Text>}
          </Text>
        </Box>
        {below}
      </Box>
    )
  })
}
