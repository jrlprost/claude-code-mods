import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { loadDays, primeCost, recordPrompt, recordTool, recordTurn } from './activity'
import { gauge, gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { hours, toMarkdown, usd, weekReport, weekStart } from './week'

const PANE = 'jr-week'
const DAY = 86_400_000
const view = atom({ plugin: 'jr-week', key: 'view' } as const, null)
const ready = { isCommand: false }

async function ensureCommand($: EngineInterface) {
  if (ready.isCommand) return
  ready.isCommand = true
  await $.command.register({ name: 'jrweek', description: 'This week with Claude: time, prompts and cost per day and project' })
}

async function refresh($: EngineInterface, back: number) {
  const now = await $.clock.now()
  const from = weekStart(now, back)
  const days = await loadDays($, from, from + 6 * DAY)
  await update($, view, () => ({ back, report: weekReport(days, from) }))
}

async function exportWeek($: EngineInterface) {
  const v = await read($, view)
  if (!v) return
  const home = (await $.env.get('HOME')) ?? '.'
  const file = `${home}/Downloads/jr-week-${new Date(v.report.from).toISOString().slice(0, 10)}.md`
  await $.fs.write(file, toMarkdown(v.report))
  $.ui.toast(`jr week · exported ${file}`)
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

  on('command.run', { command: 'jrweek' }, async $ => {
    await refresh($, 0)
    await $.ui.open({ id: PANE, title: 'jr week', focus: true, closeOnEscape: true, rows: 20 })
    return { text: 'jr week opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v) return <Text dimColor>Loading the week…</Text>
    const r = v.report
    const width = Math.max(50, e.props.bodyColumns ?? 80)
    const barWidth = Math.max(8, Math.min(30, width - 40))
    const mostDay = Math.max(1, ...r.days.map(d => d.activeMs))
    const mostProject = Math.max(1, ...r.projects.map(p => p.activeMs))
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text>
            {gradientText(Text, 'jr week', GRADIENTS.brand)}
            <Text dimColor>{`   ${r.label}`}</Text>
          </Text>
          <Box columnGap={1}>
            <Button key="this" label="This week" hotkey="t" variant={v.back === 0 ? 'primary' : 'secondary'} onPress={() => refresh($, 0)} />
            <Button key="last" label="Last week" hotkey="l" variant={v.back === 1 ? 'primary' : 'secondary'} onPress={() => refresh($, 1)} />
            <Button key="export" label="Export" hotkey="e" onPress={() => exportWeek($)} />
          </Box>
        </Box>
        <Text dimColor>{`${''.padEnd(5)}${'Claude working'.padEnd(barWidth + 1)}${'time'.padStart(6)}  prompts     cost`}</Text>
        {r.days.map(d => (
          <Text>
            <Text bold>{d.name.padEnd(5)}</Text>
            {gauge(Text, d.activeMs / mostDay, barWidth, GRADIENTS.brand)}
            <Text>{` ${hours(d.activeMs).padStart(6)}`}</Text>
            <Text dimColor>{`  ${String(d.prompts).padStart(7)}`}</Text>
            <Text color="#2cb67d">{`  ${usd(d.costUsd).padStart(7)}`}</Text>
          </Text>
        ))}
        <Text>
          <Text bold>{'Total'.padEnd(5 + barWidth)}</Text>
          <Text bold>{` ${hours(r.total.activeMs).padStart(6)}`}</Text>
          <Text bold>{`  ${String(r.total.prompts).padStart(7)}`}</Text>
          <Text color="#2cb67d" bold>{`  ${usd(r.total.costUsd).padStart(7)}`}</Text>
        </Text>
        <Text dimColor>{'─'.repeat(Math.min(width, barWidth + 32))}</Text>
        {r.projects.length === 0 && <Text dimColor>No activity recorded this week yet.</Text>}
        {r.projects.slice(0, 8).map(p => (
          <Text wrap="truncate-end">
            <Text bold>{p.name.slice(0, 18).padEnd(19)}</Text>
            {gauge(Text, p.activeMs / mostProject, Math.max(6, barWidth - 14), GRADIENTS.ice)}
            <Text>{` ${hours(p.activeMs).padStart(6)}`}</Text>
            <Text dimColor>{`  ${String(p.prompts).padStart(7)}`}</Text>
            <Text color="#2cb67d">{`  ${usd(p.costUsd).padStart(7)}`}</Text>
          </Text>
        ))}
      </Box>
    )
  })
}
