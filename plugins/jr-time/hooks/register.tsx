import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrTimeMessage, JrTimePeriod, JrTimeSession, JrTimeSettings } from '../types'
import { addPresence, CATEGORIES, DEFAULT_SETTINGS, formatHours, formatMoney, report, toCsv, toMarkdown } from './model'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'

const PANE = 'jr-time'
const SAMPLE_MS = 30_000
const SETTINGS_KEY = 'settings'
const SESSION_PREFIX = 'session:'

const view = atom({ plugin: 'jr-time', key: 'view' } as const, null)
const band = atom({ plugin: 'jr-time', key: 'band' } as const, null)
const bandHidden = atom({ plugin: 'jr-time', key: 'isBandHidden' } as const, false)

const bandState = { isLoaded: false }

/** True while the band is hidden; the saved choice is read once per load of the mod. */
async function isBandHidden($: EngineInterface) {
  if (!bandState.isLoaded) {
    bandState.isLoaded = true
    if ((await $.store.get('isBandHidden')) === true) await update($, bandHidden, () => true)
  }
  return read($, bandHidden)
}

/** Hides or shows the band for every session, kept across restarts. */
async function setBand($: EngineInterface, hide: boolean, name: string, command: string) {
  await $.store.set('isBandHidden', hide)
  await update($, bandHidden, () => hide)
  return { text: hide ? `${name} · hidden (${command} to bring it back)` : `${name} · shown` }
}

// This session's record, reloaded from the store when the module reloads.
const live: { log: JrTimeSession | null; period: JrTimePeriod; isSampling: boolean } = { log: null, period: 'today', isSampling: false }

async function loadSettings($: EngineInterface): Promise<JrTimeSettings> {
  const saved = (await $.store.get(SETTINGS_KEY)) as Partial<JrTimeSettings> | undefined
  return { ...DEFAULT_SETTINGS, ...saved, ratios: { ...DEFAULT_SETTINGS.ratios, ...saved?.ratios } }
}

async function loadSessions($: EngineInterface) {
  const keys = (await $.store.keys()).filter(k => k.startsWith(SESSION_PREFIX))
  const logs: JrTimeSession[] = []
  for (const key of keys) {
    const log = (await $.store.get(key)) as JrTimeSession | undefined
    if (log) logs.push(log)
  }
  return logs
}

async function save($: EngineInterface) {
  if (live.log) await $.store.set(SESSION_PREFIX + live.log.id, live.log)
}

/** Seconds since the last keyboard or pointer event (macOS), or null where the machine does not say. */
async function idleSeconds($: EngineInterface) {
  try {
    const { exitCode, stdout } = await $.process.run(['sh', '-c', "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'"])
    const n = Number.parseInt(stdout.trim(), 10)
    return exitCode === 0 && Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Starts recording this session, once: at session.start, or at the first event after the mod
 * was installed or reloaded mid-session, when session.start has already gone by.
 */
async function ensureRecording($: EngineInterface) {
  if (!live.log) {
    const id = await $.session.id()
    const root = await $.session.root()
    const now = await $.clock.now()
    const saved = (await $.store.get(SESSION_PREFIX + id)) as JrTimeSession | undefined
    live.log = saved ?? { id, project: root.split('/').pop() || root, start: now, last: now, prompts: [], turns: [], present: [], hasPresence: false }
    await save($)
  }
  if (!live.isSampling) {
    live.isSampling = true
    $.clock.every(SAMPLE_MS, () => {
      void sample($)
    })
  }
}

async function refresh($: EngineInterface) {
  const settings = await loadSettings($)
  const logs = await loadSessions($)
  const now = await $.clock.now()
  const current = live.log?.project ?? ''
  await update($, view, () => ({ report: report(logs, settings, live.period, now), settings, current }))
  const today = report(logs, settings, 'today', now).projects.find(p => p.project === current)
  await update($, band, () => ({ billableMs: today?.billableMs ?? 0, amount: today?.amount ?? 0, project: current, currency: settings.currency }))
}

async function sample($: EngineInterface) {
  if (!live.log) return
  const now = await $.clock.now()
  const idle = await idleSeconds($)
  if (idle !== null && idle * 1000 < SAMPLE_MS + 5000) live.log.present = addPresence(live.log.present, now, SAMPLE_MS)
  live.log.hasPresence = idle !== null
  live.log.last = now
  await save($)
  await refresh($)
}

async function exportReport($: EngineInterface) {
  const settings = await loadSettings($)
  const logs = await loadSessions($)
  const now = await $.clock.now()
  const r = report(logs, settings, live.period, now)
  const home = (await $.env.get('HOME')) ?? '.'
  const day = new Date(now).toISOString().slice(0, 10)
  const base = `${home}/Downloads/jr-time-${live.period}-${day}`
  await $.fs.write(`${base}.csv`, toCsv(r, settings, logs, now))
  await $.fs.write(`${base}.md`, toMarkdown(r, settings))
  return base
}

async function applyMessage($: EngineInterface, message: JrTimeMessage) {
  if (message.type === 'export') {
    const base = await exportReport($)
    $.ui.toast(`jr time · exported ${base}.csv and .md`)
    return
  }
  if (message.type === 'period') {
    live.period = message.period
    return refresh($)
  }
  const s = await loadSettings($)
  if (message.type === 'ratio') s.ratios[message.category] = Math.max(0, Math.min(200, s.ratios[message.category] + message.delta))
  if (message.type === 'setting') s[message.key] = Math.max(message.key === 'idleMin' ? 1 : 0, Math.min(60, s[message.key] + message.delta))
  if (message.type === 'rate') s.rates[message.project] = Math.max(0, (s.rates[message.project] ?? s.defaultRate) + message.delta)
  await $.store.set(SETTINGS_KEY, s)
  await refresh($)
}

/** `/jrtime client Acme`, `/jrtime rate 90`, `/jrtime rate default 60`, `/jrtime currency $`, `/jrtime export`. */
async function runCommand($: EngineInterface, args: string) {
  const [verb = '', ...rest] = args.trim().split(/\s+/).filter(Boolean)
  const project = live.log?.project ?? ''
  const s = await loadSettings($)
  if (verb === 'client' && rest.length) {
    s.clients[project] = rest.join(' ')
  } else if (verb === 'rate' && rest[0] === 'default' && rest[1]) {
    s.defaultRate = Number(rest[1]) || 0
  } else if (verb === 'rate' && rest[0]) {
    s.rates[project] = Number(rest[0]) || 0
  } else if (verb === 'currency' && rest[0]) {
    s.currency = rest[0]
  } else if (verb === 'export') {
    return `jr time · exported ${await exportReport($)}.csv and .md`
  } else if (verb) {
    return 'jr time · usage: /jrtime, /jrtime client <name>, /jrtime rate <per hour>, /jrtime rate default <per hour>, /jrtime currency <symbol>, /jrtime export, /jrtime hide, /jrtime show'
  } else {
    return null
  }
  await $.store.set(SETTINGS_KEY, s)
  await refresh($)
  return `jr time · ${project}: client ${s.clients[project] ?? project}, ${s.rates[project] ?? s.defaultRate} ${s.currency}/h`
}

export const register: Register = (on, options) => {
  const showBand = options.showBand !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'jrtime', description: 'Billable time: categories, ratios, hourly rate, export; /jrtime hide or show toggles the band' })
    await ensureRecording($)
    await refresh($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    await ensureRecording($)
    if (live.log && !e.command && !e.isMeta) {
      const now = await $.clock.now()
      live.log.prompts.push(now)
      live.log.last = now
      await save($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await ensureRecording($)
    if (live.log && e.agentId === undefined) {
      const now = await $.clock.now()
      live.log.turns.push([now - e.durationMs, now])
      live.log.last = now
      await save($)
      await refresh($)
    }
    return done
  })

  on('command.run', { command: 'jrtime' }, async ($, e) => {
    await ensureRecording($)
    const word = e.args.trim().toLowerCase()
    if (word === 'hide' || word === 'show') return setBand($, word === 'hide', 'jr time band', '/jrtime show')
    const answer = await runCommand($, e.args)
    if (answer) return { text: answer }
    await refresh($)
    await $.ui.open({ id: PANE, title: 'jr time', focus: true, closeOnEscape: true, rows: CATEGORIES.length + 12 })
    return { text: 'jr time opened.' }
  })

  on('ui.message', { requestId: PANE }, async ($, e) => {
    await applyMessage($, e.data as JrTimeMessage)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Client } = $.ui.resolve(e) as unknown as { Client?: (p: Record<string, unknown>) => never }
    const { Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v) return <Text>No time recorded yet.</Text>
    if (!Client) return <Text>{`Billable today: ${formatHours(v.report.billableMs)} · ${formatMoney(v.report.amount, v.settings.currency)}`}</Text>
    return <Client key="time" module="./time.client.tsx" props={{ view: v }} height="100%" flexGrow={1} />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const b = await read($, band)
    if (!b && !live.isSampling) {
      $.clock.after(0, () => {
        void ensureRecording($).then(() => refresh($))
      })
    }
    if (await isBandHidden($)) return below
    if (!showBand || !b || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'time ', GRADIENTS.brand)}
          <Text color="#2cb67d">{'● '}</Text>
          <Text bold>{formatHours(b.billableMs)}</Text>
          <Text dimColor>{` billable today · ${b.project}`}</Text>
          {b.amount > 0 && <Text color="#2cb67d" bold>{` · ${formatMoney(b.amount, b.currency)}`}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}
