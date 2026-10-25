import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { JrModAuditPlugin, JrModAuditReport } from '../types'
import { assess, parseCalls, parseTarget, RISK_LABEL, scanSource } from './audit'
import { gradientText } from './jr/draw'
import { GRADIENTS } from './jr/gradient'
import { safeGit } from './jr/git'
import { printable } from './jr/text'

const PANE = 'jr-mod-audit'
const WORK = '/tmp/jr-mod-audit'
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/
const report = atom({ plugin: 'jr-mod-audit', key: 'report' } as const, null)
const registered = { command: false }

async function registerCommand($: EngineInterface) {
  if (registered.command) return
  registered.command = true
  await $.command.register({ name: 'jr-mod-audit', description: 'Audit a mod before installing it: /jr-mod-audit owner/repo, a git URL or a folder' })
}

const RISK_COLOR = { green: '#2cb67d', amber: '#f4d35e', red: '#ef4565' } as const

async function lines($: EngineInterface, argv: string[]) {
  const { exitCode, stdout } = await $.process.run(argv, { timeoutMs: 120_000 })
  return exitCode === 0 ? stdout.split('\n').filter(Boolean) : []
}

async function auditPlugin($: EngineInterface, dir: string): Promise<JrModAuditPlugin> {
  const { stdout } = await $.process.run(['claude', 'plugin', 'validate', dir, '--json'], { timeoutMs: 60_000 })
  let isValid = false
  let errors: string[] = []
  let notes: string[] = []
  let name = dir.split('/').pop() ?? dir
  try {
    const json = JSON.parse(stdout) as { success: boolean; manifest?: { errors?: string[]; notes?: string[] }; contents?: { errors?: string[]; notes?: string[] }[] }
    isValid = json.success
    errors = [...(json.manifest?.errors ?? []), ...(json.contents ?? []).flatMap(c => c.errors ?? [])].map(String)
    notes = [...(json.manifest?.notes ?? []), ...(json.contents ?? []).flatMap(c => c.notes ?? [])].map(String)
  } catch {
    errors = ['the validator gave no report']
  }
  try {
    name = (JSON.parse(await $.fs.read(`${dir}/.claude-plugin/plugin.json`)) as { name?: string }).name ?? name
  } catch {
    // keep the folder name
  }
  let source = ''
  for (const file of (await lines($, ['find', dir, '-type', 'f', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/tests/*'])).filter(f => SOURCE.test(f)).slice(0, 60)) {
    try {
      source += `\n${await $.fs.read(file)}`
    } catch {
      // unreadable or over 4 MiB: skipped
    }
  }
  const calls = parseCalls(notes)
  const { hosts, commands } = scanSource(source)
  const { risk, why } = assess(calls, hosts, commands, isValid)
  return { name, dir, isValid, errors, calls, hosts, commands, risk, why }
}

/** Every string in the report made printable: names, errors and validator lines come from the audited repo. */
const printableDeep = <T,>(value: T): T => {
  if (typeof value === 'string') return printable(value, 300) as T
  if (Array.isArray(value)) return value.map(printableDeep) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, printableDeep(v)])) as T
  return value
}

async function runAudit($: EngineInterface, arg: string): Promise<JrModAuditReport> {
  const target = parseTarget(arg, (await $.env.get('HOME')) ?? '')
  if (!target) return { target: arg, status: 'error', error: 'Give a GitHub owner/repo, a git URL or a local folder.', plugins: [] }
  let root = target.source
  if (target.kind !== 'local') {
    root = `${WORK}/${await $.clock.now()}`
    await $.process.run(['mkdir', '-p', WORK])
    const clone = await $.process.run(safeGit(['clone', '--depth', '1', '--quiet', '-c', 'core.symlinks=false', target.source, root]), { timeoutMs: 120_000 })
    if (clone.exitCode !== 0) return { target: arg, status: 'error', error: `git clone failed: ${clone.stderr.trim().slice(0, 200)}`, plugins: [] }
  }
  const manifests = await lines($, ['find', root, '-path', '*/.claude-plugin/plugin.json', '-not', '-path', '*/node_modules/*'])
  const plugins: JrModAuditPlugin[] = []
  for (const manifest of manifests.slice(0, 40)) plugins.push(await auditPlugin($, manifest.replace(/\/\.claude-plugin\/plugin\.json$/, '')))
  if (plugins.length === 0) return { target: arg, status: 'error', error: 'No plugin found (no .claude-plugin/plugin.json).', plugins }
  const order = { red: 0, amber: 1, green: 2 }
  plugins.sort((a, b) => order[a.risk] - order[b.risk] || a.name.localeCompare(b.name))
  return { target: arg, status: 'done', plugins }
}

const summaryText = (r: JrModAuditReport) =>
  r.status === 'error'
    ? `jr mod audit · ${r.error}`
    : `jr mod audit · ${r.target}: ${r.plugins.map(p => `${p.risk === 'red' ? '🔴' : p.risk === 'amber' ? '🟡' : '🟢'} ${p.name}`).join(', ')}`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await registerCommand($)
    return started
  })

  // Installed mid-session, the mod saw no session.start: its command is registered on the first draw.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!registered.command) {
      $.clock.after(0, () => {
        void registerCommand($)
      })
    }
    return next(e)
  })

  on('command.run', { command: 'jr-mod-audit' }, async ($, e) => {
    await update($, report, (): JrModAuditReport => ({ target: e.args.trim(), status: 'running', plugins: [] }))
    await $.ui.open({ id: PANE, title: 'jr mod audit', rows: 24 })
    // Everything in the report comes from the audited repository: printable text only.
    const done = printableDeep(await runAudit($, e.args))
    await update($, report, () => done)
    return { text: summaryText(done) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, report)
    if (!r) return <Text dimColor>Run /jr-mod-audit owner/repo to audit a mod.</Text>
    return (
      <Box flexDirection="column">
        <Box>
          {gradientText(Text, 'jr mod audit', GRADIENTS.brand)}
          <Text dimColor>{`  ${r.target}`}</Text>
        </Box>
        {r.status === 'running' && <Text dimColor>Cloning and validating…</Text>}
        {r.status === 'error' && <Text color={RISK_COLOR.red}>{r.error}</Text>}
        {r.plugins.map(p => (
          <Box flexDirection="column">
            <Text>
              <Text color={RISK_COLOR[p.risk]} bold>{'● '}</Text>
              <Text bold>{p.name}</Text>
              <Text color={RISK_COLOR[p.risk]}>{`  ${RISK_LABEL[p.risk]}`}</Text>
              {!p.isValid && <Text color={RISK_COLOR.red}>{'  validation failed'}</Text>}
            </Text>
            {p.why.map(w => (
              <Text dimColor wrap="truncate-end">{`    · ${w}`}</Text>
            ))}
            {p.calls.length > 0 && <Text dimColor wrap="truncate-end">{`    calls ${p.calls.join(' ')}`}</Text>}
            {p.errors.slice(0, 3).map(err => (
              <Text color={RISK_COLOR.red} wrap="truncate-end">{`    ✘ ${err}`}</Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
