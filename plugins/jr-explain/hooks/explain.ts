// Plain-English explanations of shell commands, from a table first.
import { printable } from './jr/text'

export type Risk = 'low' | 'medium' | 'high'
/** `isGuess`: written by a model, so steerable by the command it reads; never shown as low risk. */
export type Explanation = { what: string; risk: Risk; isGuess?: true }

const TABLE: { test: RegExp; what: string; risk: Risk }[] = [
  { test: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/, what: 'downloads a script from the internet and runs it', risk: 'high' },
  { test: /\bsudo\b/, what: 'runs a command as administrator', risk: 'high' },
  { test: /\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b/, what: 'deletes files and folders, including everything inside them', risk: 'high' },
  { test: /\bgit\s+push\b[^;&|]*(\s-f\b|--force)/, what: 'overwrites the remote branch history with yours', risk: 'high' },
  { test: /\bgit\s+reset\s+--hard\b/, what: 'throws away uncommitted changes', risk: 'high' },
  { test: /\bgit\s+clean\s+-[a-zA-Z]*f/, what: 'deletes untracked files', risk: 'high' },
  { test: /\bgit\s+(checkout|restore)\s+(--\s+)?\./, what: 'throws away uncommitted edits in the working tree', risk: 'high' },
  { test: /\b(dd|mkfs|diskutil\s+erase)\b/, what: 'writes directly to a disk', risk: 'high' },
  { test: /\b(drop\s+(table|database)|truncate\s+table)\b/i, what: 'deletes database tables or data', risk: 'high' },
  { test: /\bchmod\s+-R\b|\bchown\s+-R\b/, what: 'changes permissions on a whole folder tree', risk: 'medium' },
  { test: /\brm\b/, what: 'deletes files', risk: 'medium' },
  { test: /\bgit\s+push\b/, what: 'uploads your commits to the remote repository', risk: 'medium' },
  { test: /\bgit\s+(rebase|merge|cherry-pick)\b/, what: 'rewrites or combines branch history', risk: 'medium' },
  { test: /\bgit\s+commit\b/, what: 'records the staged changes as a commit', risk: 'low' },
  { test: /\bgit\s+(status|log|diff|show|branch|fetch)\b/, what: 'reads the git history and state', risk: 'low' },
  { test: /\b(npm|pnpm|yarn|bun)\s+(install|i|add|ci)\b|\bpip3?\s+install\b|\buv\s+add\b|\bcargo\s+add\b|\bgem\s+install\b|\bbrew\s+install\b/, what: 'installs packages, which may run their own install scripts', risk: 'medium' },
  { test: /\bnpx\b|\bpnpm\s+dlx\b|\buvx\b|\bbunx\b/, what: 'downloads a package and runs it', risk: 'medium' },
  { test: /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|build|lint|dev|start|typecheck)\b/, what: 'runs a project script from package.json', risk: 'low' },
  { test: /\bdocker\s+(system\s+prune|volume\s+rm|rm\s+-f)\b/, what: 'deletes Docker containers, volumes or caches', risk: 'high' },
  { test: /\bdocker\s+(run|compose\s+up|build)\b/, what: 'builds or starts containers', risk: 'medium' },
  { test: /\b(kill|pkill|killall)\b/, what: 'stops running processes', risk: 'medium' },
  { test: /\b(launchctl|crontab|systemctl)\b/, what: 'changes background services or scheduled jobs', risk: 'medium' },
  { test: /\b(ssh|scp|rsync)\b/, what: 'connects to or copies files to another machine', risk: 'medium' },
  { test: /\bsed\s+-i\b|\bperl\s+-pi\b/, what: 'edits files in place', risk: 'medium' },
  { test: /\bmv\b/, what: 'moves or renames files', risk: 'medium' },
  { test: /\b(curl|wget|http)\b/, what: 'fetches a web address', risk: 'low' },
  { test: /\b(cp|mkdir|touch)\b/, what: 'copies files or creates folders', risk: 'low' },
  { test: /\b(ls|cat|head|tail|grep|rg|find|wc|pwd|echo|which|stat|du|df)\b/, what: 'reads files or folders', risk: 'low' },
  { test: /\b(python3?|node|ruby|bash|sh|zsh)\s+\S+/, what: 'runs a script', risk: 'medium' },
]

const RANK: Record<Risk, number> = { low: 0, medium: 1, high: 2 }

const segments = (command: string) => command.split(/&&|\|\||;|\n/).map(s => s.trim()).filter(Boolean)

/** One explanation per part of a compound command, then the highest risk of them. */
export const explainCommand = (command: string): Explanation | null => {
  const found: Explanation[] = []
  for (const part of segments(command)) {
    const row = TABLE.find(r => r.test.test(part))
    if (row && !found.some(f => f.what === row.what)) found.push({ what: row.what, risk: row.risk })
  }
  if (found.length === 0) return null
  const risk = found.reduce<Risk>((max, f) => (RANK[f.risk] > RANK[max] ? f.risk : max), 'low')
  const what = found.slice(0, 3).map(f => f.what)
  const sentence = what.length === 1 ? what[0]! : `${what.slice(0, -1).join(', ')}, then ${what[what.length - 1]}`
  return { what: sentence.charAt(0).toUpperCase() + sentence.slice(1), risk }
}

export const RISK_MARK: Record<Risk, string> = { low: '🟢 low risk', medium: '🟡 medium risk', high: '🔴 high risk' }

const mark = (e: Explanation) => `${RISK_MARK[e.risk]}${e.isGuess ? ' (a guess)' : ''}`

/** The toast shown beside the permission dialog, naming the command it explains. */
export const toastFor = (e: Explanation, command: string) =>
  `${mark(e)} · ${printable(e.what, 160)} · $ ${printable(command.replace(/\s+/g, ' ').trim(), 80)}`

export const reasonFor = (e: Explanation, previous?: string) => `${printable(e.what, 160)}. ${mark(e)}.${previous ? ` (${previous})` : ''}`

/**
 * The command as the model reads it: whole, between markers, as data. Nothing is cut out, so no
 * part of it can be hidden from the model (cutting "comments" with a pattern also cuts a # inside
 * quotes, and whatever follows it). Instructions planted in it are handled after the answer: the
 * risk is never below medium, and an answer that echoes the command is refused.
 */
export const commandPrompt = (command: string) =>
  `<command>\n${command.slice(0, 2000).replaceAll('</command>', '<\\/command>')}\n</command>`

/** True when the answer repeats four words in a row from the command: text the command planted. */
export const echoesCommand = (answer: string, command: string) => {
  const words = (t: string) => t.toLowerCase().match(/[a-z0-9']+/g) ?? []
  const said = ` ${words(answer).join(' ')} `
  const cmd = words(command)
  for (let i = 0; i + 4 <= cmd.length; i++) if (said.includes(` ${cmd.slice(i, i + 4).join(' ')} `)) return true
  return false
}

/**
 * Reads the model's one-line answer: "<explanation> | <low|medium|high>". A model can be steered
 * by the command it explains, so its risk is never below medium, its text is made printable and
 * marked as a guess, and an answer that echoes the command is refused.
 */
export const parseModelAnswer = (text: string, command = ''): Explanation | null => {
  const m = text.trim().match(/^(.+?)\s*\|\s*(low|medium|high)\s*$/i)
  if (!m || echoesCommand(m[1]!, command)) return null
  const risk = m[2]!.toLowerCase() === 'high' ? 'high' : 'medium'
  return { what: printable(m[1]!.replace(/\.$/, ''), 160), risk, isGuess: true }
}
