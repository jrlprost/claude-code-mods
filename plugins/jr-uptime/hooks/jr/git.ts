// git in a repository the mod does not trust. A repository's own config and attributes can make
// git run programs: fsmonitor, external diff and textconv drivers, clean/smudge filters, ssh and
// credential helpers, pagers, editors, or an include pulling any of these from elsewhere.
// Two layers: config overrides on every call, and repoIsSafe() before any command that reads
// the working tree (diff, ls-files), which refuses a repo that sets up any such mechanism.
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

// Sections and keys through which a repository's config can make git run a program
// (or pull in config that does, for include/includeIf).
const RISKY_SECTION = /^\[\s*(include|includeif|filter|diff\s+"|merge\s+"|credential|alias|gpg)/
const RISKY_KEY = /^(fsmonitor|sshcommand|askpass|editor|pager|hookspath|textconv|command|clean|smudge|process|helper|program|external|driver)\s*=/
// .gitattributes naming a filter, diff or merge driver.
const RISKY_ATTRIBUTE = /(^|\s)(filter|diff|merge)=/m

/** Whether git config text or .gitattributes text sets up anything that runs a program. */
export const isRiskyGitConfig = (config: string, attributes = '') =>
  config
    .toLowerCase()
    .split('\n')
    .map(line => line.trim())
    .some(line => RISKY_SECTION.test(line) || RISKY_KEY.test(line)) || RISKY_ATTRIBUTE.test(attributes)

async function readText($: EngineInterface, file: string) {
  try {
    return await $.fs.read(file)
  } catch {
    return undefined
  }
}

/**
 * True only when the repository at `root` has a plain .git directory whose config and whose
 * .gitattributes set up nothing that runs a program. Anything unreadable or unusual is unsafe.
 */
export async function repoIsSafe($: EngineInterface, root: string) {
  const config = await readText($, `${root}/.git/config`)
  if (config === undefined) return false
  const attributes = (await readText($, `${root}/.gitattributes`)) ?? ''
  const info = (await readText($, `${root}/.git/info/attributes`)) ?? ''
  return !isRiskyGitConfig(config, `${attributes}\n${info}`)
}
