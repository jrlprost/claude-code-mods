// Turns a mod's validator report and source into a risk verdict.

export type Risk = 'green' | 'amber' | 'red'

export type PluginReport = {
  name: string
  dir: string
  isValid: boolean
  errors: string[]
  calls: string[]
  hosts: string[]
  commands: string[]
  risk: Risk
  why: string[]
}

export type Target = { kind: 'github' | 'url' | 'local'; source: string }

export const parseTarget = (arg: string, home: string): Target | null => {
  const a = arg.trim()
  if (!a) return null
  if (a.startsWith('/')) return { kind: 'local', source: a }
  if (a.startsWith('~/')) return { kind: 'local', source: `${home}${a.slice(1)}` }
  if (/^(https?:\/\/|git@)/.test(a)) return { kind: 'url', source: a }
  const gh = a.replace(/^github\.com\//, '').match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  return gh ? { kind: 'github', source: `https://github.com/${gh[1]}/${gh[2]}.git` } : null
}

/** `$.process.run`, `$.http.fetch` … from the validator's "calls:" notes. */
export const parseCalls = (notes: readonly string[]) => {
  const calls = new Set<string>()
  for (const note of notes) {
    const m = note.match(/\bcalls: (.+)$/)
    if (!m) continue
    for (const part of (m[1] ?? '').split(/,\s*(?![^()]*\))/)) {
      const call = part.replace(/\s*\(via [^)]*\)/, '').trim()
      if (call.startsWith('$.')) calls.add(call)
    }
  }
  return [...calls].sort()
}

/** Hosts named in the source, and the programs it runs by name. */
export const scanSource = (source: string) => {
  const hosts = new Set<string>()
  for (const m of source.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) hosts.add(m[1]!.toLowerCase())
  const commands = new Set<string>()
  for (const m of source.matchAll(/process\.(?:run|spawn)\(\s*(?:\{\s*argv:\s*)?\[\s*['"`]([^'"`]+)['"`]/g)) commands.add(m[1]!)
  return { hosts: [...hosts].sort(), commands: [...commands].sort() }
}

const DOCS_HOSTS = /(^|\.)(github\.com|githubusercontent\.com|example\.com|anthropic\.com|claude\.com|claude\.ai|json\.schemastore\.org|npmjs\.com)$/

export const assess = (calls: readonly string[], hosts: readonly string[], commands: readonly string[], isValid: boolean): { risk: Risk; why: string[] } => {
  const has = (prefix: string) => calls.some(c => c.startsWith(prefix))
  const why: string[] = []
  const network = has('$.http.')
  const runs = has('$.process.')
  const reads = has('$.fs.read') || has('$.fs.list') || has('$.env.get') || has('$.session.messages')
  const writes = has('$.fs.write') || has('$.env.set')
  const drives = has('$.prompt.submit') || has('$.agent.') || has('$.tool.call')
  const outsideHosts = hosts.filter(h => !DOCS_HOSTS.test(h))
  const shells = commands.filter(c => /^(sh|bash|zsh|curl|wget|python3?|node|osascript)$/.test(c))
  if (!isValid) why.push('does not pass claude plugin validate')
  if (network && (reads || runs)) why.push('reads local data or runs programs, and talks to the network')
  if (shells.length) why.push(`runs ${shells.join(', ')}`)
  const isRed = why.length > 0
  if (network) why.push(`network${outsideHosts.length ? `: ${outsideHosts.join(', ')}` : ''}`)
  if (runs) why.push(`runs programs${commands.length ? `: ${commands.join(', ')}` : ''}`)
  if (writes) why.push('writes files or environment')
  if (drives) why.push('sends prompts, starts agents or calls tools')
  if (reads) why.push('reads files, environment or the conversation')
  const risk: Risk = isRed ? 'red' : network || runs || writes || drives ? 'amber' : 'green'
  return { risk, why: [...new Set(why)] }
}

export const RISK_LABEL: Record<Risk, string> = { green: 'low reach', amber: 'check what it does', red: 'read the code before installing' }
