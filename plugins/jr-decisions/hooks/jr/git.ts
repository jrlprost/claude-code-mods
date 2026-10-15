// git in a repository the mod does not trust. A repository's config can make git run programs:
// fsmonitor, external diff and textconv drivers, clean/smudge filters, ssh and credential helpers,
// pagers, editors, aliases, or an include pulling any of these from another file.
// Two layers: config overrides on every call, and repoIsSafe() before any command that reads the
// working tree. repoIsSafe asks git itself which config it would use there (so there is no parser
// of ours to fool) and refuses when an entry able to run a program comes from anywhere but the
// person's own setup (what git reads outside any repository).
// Synced into each plugin's hooks/jr/ by scripts/sync-shared.sh.
import type { EngineInterface } from 'claude-code'

const SAFE_CONFIG = [
  '-c', 'core.fsmonitor=false',
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.pager=cat',
  '-c', 'core.editor=true',
  '-c', 'core.sshCommand=false',
  '-c', 'core.askPass=false',
  '-c', 'credential.helper=',
  '-c', 'diff.external=',
  '-c', 'core.untrackedCache=false',
  '-c', 'protocol.ext.allow=never',
]

/** `git <args>` with command-running config switched off. Diffs never run external drivers. */
export const safeGit = (args: readonly string[]) => {
  const rest = [...args]
  if (rest[0] === '-C') rest.splice(0, 2)
  const cwd = args[0] === '-C' ? ['-C', args[1] ?? '.'] : []
  const extra = rest[0] === 'diff' ? ['--no-ext-diff', '--no-textconv'] : []
  return ['git', ...SAFE_CONFIG, ...cwd, ...(rest.length ? [rest[0]!, ...extra, ...rest.slice(1)] : [])]
}

export type GitConfigEntry = { origin: string; key: string; value: string }

/** Parses `git config --list --show-origin -z`: records of origin NUL key LF value NUL. */
export const parseConfigListing = (listing: string): GitConfigEntry[] => {
  const parts = listing.split('\0')
  const entries: GitConfigEntry[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const origin = parts[i]!
    const record = parts[i + 1]!
    const nl = record.indexOf('\n')
    entries.push({ origin, key: (nl < 0 ? record : record.slice(0, nl)).toLowerCase(), value: nl < 0 ? '' : record.slice(nl + 1) })
  }
  return entries
}

// The last part of a key (git keys are section[.subsection].name, already lower-cased by git
// for section and name) that makes git run a program, plus whole sections that do.
const RISKY_NAME = /\.(fsmonitor|sshcommand|askpass|editor|pager|hookspath|textconv|command|clean|smudge|process|driver|helper|program|external|packobjectshook|gitproxy)$/
const RISKY_SECTION = /^(alias|include|includeif)\./

/** Entries able to run a program that come from somewhere other than the trusted origins. */
export const riskyEntries = (entries: readonly GitConfigEntry[], trustedOrigins: ReadonlySet<string>) =>
  entries.filter(e => !trustedOrigins.has(e.origin) && !e.origin.startsWith('command line:') && (RISKY_NAME.test(e.key) || RISKY_SECTION.test(e.key)))

async function listing($: EngineInterface, args: readonly string[]) {
  try {
    const out = await $.process.run(args)
    return out.exitCode === 0 ? out.stdout : null
  } catch {
    return null
  }
}

/**
 * True only when the config git would use at `root` holds nothing able to run a program beyond
 * what the person's own global and system config set up. Any failure counts as unsafe.
 */
export async function repoIsSafe($: EngineInterface, root: string) {
  const local = await listing($, safeGit(['-C', root, 'config', '--list', '--show-origin', '-z']))
  if (local === null) return false
  // What git reads outside any repository is the person's own setup: global, system, and the
  // config the git build ships (Apple's git keeps it next to Xcode, not in /etc/gitconfig).
  const own = await listing($, safeGit(['-C', '/', 'config', '--list', '--show-origin', '-z']))
  const trusted = new Set(parseConfigListing(own ?? '').map(e => e.origin))
  return riskyEntries(parseConfigListing(local), trusted).length === 0
}
