import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { loadDays, primeCost, recordPrompt, recordTool, recordTurn } from './activity'
import { gridStart, grid, LEVEL_COLORS, monthLabels, peakHours, streaks, WEEKS } from './heat'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-heatmap'
const view = atom({ plugin: 'jr-heatmap', key: 'view' } as const, null)
const ready = { isCommand: false }
const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

async function ensureCommand($: EngineInterface) {
  if (ready.isCommand) return
  ready.isCommand = true
  await $.command.register({ name: 'jrheatmap', description: 'Your last 26 weeks with Claude as a heatmap, streaks and peak hours' })
}

async function refresh($: EngineInterface) {
  const now = await $.clock.now()
  const days = await loadDays($, gridStart(now), now)
  const total = Object.values(days).reduce((n, d) => n + d.prompts, 0)
  const activeDays = Object.values(days).filter(d => d.prompts > 0).length
  await update($, view, () => ({
    cells: grid(days, now).map(row => row.map(c => (c.isFuture ? -1 : c.level))),
    months: monthLabels(now),
    streaks: streaks(days, now),
    hours: peakHours(days),
    total,
    activeDays,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    await primeCost($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    await ensureCommand($)
    if (!e.command && !e.isMeta) {
      await primeCost($)
      await recordPrompt($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await recordTurn($, e.durationMs)
    return done
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    await recordTool($, String(e.tool))
    return ran
  })

  on('command.run', { command: 'jrheatmap' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'jr heatmap', rows: 16 })
    return { text: 'jr heatmap opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v) return <Text dimColor>Loading…</Text>
    const most = Math.max(1, ...v.hours)
    const peak = v.hours.indexOf(Math.max(...v.hours))
    return (
      <Box flexDirection="column">
        <Text>
          {gradientText(Text, 'jr heatmap', GRADIENTS.brand)}
          <Text dimColor>{`   last ${WEEKS} weeks · ${v.total} prompts on ${v.activeDays} days`}</Text>
        </Text>
        <Text dimColor>{`    ${v.months}`}</Text>
        {v.cells.map((row, r) => (
          <Text>
            <Text dimColor>{(DAYS[r] ?? '').padEnd(4)}</Text>
            {row.map(level => (level < 0 ? <Text>{'  '}</Text> : <Text color={LEVEL_COLORS[level]}>{'■ '}</Text>))}
          </Text>
        ))}
        <Text>
          <Text dimColor>{'    less '}</Text>
          {LEVEL_COLORS.map(c => (
            <Text color={c}>{'■ '}</Text>
          ))}
          <Text dimColor>{'more'}</Text>
        </Text>
        <Text> </Text>
        <Text>
          <Text color="#ffb86b">{'✦ '}</Text>
          <Text bold>{`${v.streaks.current} day${v.streaks.current === 1 ? '' : 's'}`}</Text>
          <Text dimColor>{' current streak   '}</Text>
          <Text bold>{`${v.streaks.longest} day${v.streaks.longest === 1 ? '' : 's'}`}</Text>
          <Text dimColor>{' longest'}</Text>
        </Text>
        <Text>
          <Text dimColor>{'hours '}</Text>
          {v.hours.map(n => (
            <Text color={LEVEL_COLORS[Math.min(4, Math.ceil((n / most) * 4))]}>{'█'}</Text>
          ))}
          <Text dimColor>{v.total > 0 ? `  peak ${String(peak).padStart(2, '0')}:00` : ''}</Text>
        </Text>
        <Text dimColor>{'      0     6     12    18    23'}</Text>
      </Box>
    )
  })
}
