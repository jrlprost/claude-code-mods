import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { loadDays, primeCost, recordPrompt, recordTool, recordTurn } from './activity'
import { gradientText } from './jr/draw'
import { GRADIENTS, paint } from './jr/gradient'
import { hourLabel, hours, parseMonth, toSvg, wrapMonth } from './wrap'

const PANE = 'jr-wrapped'
const view = atom({ plugin: 'jr-wrapped', key: 'view' } as const, null)
const ready = { isCommand: false }

async function ensureCommand($: EngineInterface) {
  if (ready.isCommand) return
  ready.isCommand = true
  await $.command.register({ name: 'jr-wrapped', description: 'Your month with Claude, Wrapped-style; /jr-wrapped last, /jr-wrapped 2026-09, /jr-wrapped export' })
}

async function build($: EngineInterface, arg: string) {
  const now = await $.clock.now()
  const { year, month } = parseMonth(arg, now)
  const days = await loadDays($, new Date(year, month, 1).getTime(), new Date(year, month + 1, 0, 12).getTime())
  const w = wrapMonth(days, year, month)
  await update($, view, () => w)
  return w
}

/** Writes the card as SVG, then as PNG when rsvg-convert or ImageMagick can draw it. */
async function exportCard($: EngineInterface) {
  const w = await read($, view)
  if (!w) return 'Open /jr-wrapped first.'
  const home = (await $.env.get('HOME')) ?? '.'
  const base = `${home}/Downloads/claude-wrapped-${w.month}`
  await $.fs.write(`${base}.svg`, toSvg(w))
  for (const argv of [
    ['rsvg-convert', '-o', `${base}.png`, `${base}.svg`],
    ['magick', `${base}.svg`, `${base}.png`],
  ]) {
    try {
      const { exitCode } = await $.process.run(argv)
      // ImageMagick can exit 0 without writing when it lacks a font: check the file.
      if (exitCode === 0 && (await $.fs.exists(`${base}.png`))) return `Saved ${base}.png and .svg`
    } catch {
      // Not installed: try the next converter.
    }
  }
  return `Saved ${base}.svg`
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

  on('command.run', { command: 'jr-wrapped' }, async ($, e) => {
    if (e.args.trim() === 'export') {
      if (!(await read($, view))) await build($, '')
      return { text: `jr wrapped · ${await exportCard($)}` }
    }
    const w = await build($, e.args)
    await $.ui.open({ id: PANE, title: 'jr wrapped', focus: true, closeOnEscape: true, rows: 24 })
    return { text: `jr wrapped · ${w.label}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const w = await read($, view)
    if (!w) return <Text dimColor>Wrapping…</Text>
    const stat = (value: string, label: string) => (
      <Box flexDirection="column" width={18}>
        <Text bold>{value}</Text>
        <Text dimColor>{label}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column" rowGap={1}>
        <Box flexDirection="column">
          <Text dimColor>{'JR MODS · CLAUDE WRAPPED'}</Text>
          <Text bold>
            {paint(w.label.toUpperCase(), GRADIENTS.brand).map(({ char, color }) => (
              <Text color={color}>{char}</Text>
            ))}
          </Text>
          <Text>
            {gradientText(Text, w.persona.title, ['#ff5ca8', '#ffb86b'])}
            <Text dimColor>{` · ${w.persona.line}`}</Text>
          </Text>
        </Box>
        <Box columnGap={2} flexWrap="wrap">
          {stat(w.prompts.toLocaleString('en-US'), 'prompts')}
          {stat(hours(w.activeMs), 'Claude working')}
          {stat(String(w.activeDays), 'active days')}
          {stat(`${w.longestStreak}d`, 'longest streak')}
          {stat(hourLabel(w.busiestHour), 'busiest hour')}
          {stat(`$${w.costUsd.toFixed(2)}`, 'spent')}
        </Box>
        <Box columnGap={6} flexWrap="wrap">
          <Box flexDirection="column">
            <Text dimColor>{'TOP TOOLS'}</Text>
            {w.topTools.length === 0 && <Text dimColor>—</Text>}
            {w.topTools.map((t, i) => (
              <Text>
                <Text color="#ff5ca8" bold>{`${i + 1}. `}</Text>
                {`${t.name} `}
                <Text dimColor>{String(t.count)}</Text>
              </Text>
            ))}
          </Box>
          <Box flexDirection="column">
            <Text dimColor>{'TOP PROJECTS'}</Text>
            {w.topProjects.length === 0 && <Text dimColor>—</Text>}
            {w.topProjects.map((p, i) => (
              <Text>
                <Text color="#ffb86b" bold>{`${i + 1}. `}</Text>
                {`${p.name} `}
                <Text dimColor>{`${p.prompts} prompts`}</Text>
              </Text>
            ))}
          </Box>
        </Box>
        <Button
          key="export"
          label="Save the card to Downloads"
          hotkey="e"
          variant="primary"
          onPress={async () => {
            $.ui.toast(`jr wrapped · ${await exportCard($)}`)
          }}
        />
      </Box>
    )
  })
}
