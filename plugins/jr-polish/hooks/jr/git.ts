// git argv for a repository the mod does not trust. A repo's own config can make git run
// programs (core.fsmonitor, diff.external, textconv drivers, a pager); these overrides switch
// them off for this one call. Synced into each plugin's hooks/jr/ by scripts/sync-shared.sh.

const SAFE_CONFIG = [
  '-c', 'core.fsmonitor=false',
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.pager=cat',
  '-c', 'diff.external=',
  '-c', 'core.untrackedCache=false',
  '-c', 'protocol.ext.allow=never',
]

/** `git <args>` with the repo's command-running config switched off. Diffs never run external drivers. */
export const safeGit = (args: readonly string[]) => {
  const rest = [...args]
  if (rest[0] === '-C') rest.splice(0, 2)
  const cwd = args[0] === '-C' ? ['-C', args[1] ?? '.'] : []
  const extra = rest[0] === 'diff' ? ['--no-ext-diff', '--no-textconv'] : []
  return ['git', ...SAFE_CONFIG, ...cwd, ...(rest.length ? [rest[0]!, ...extra, ...rest.slice(1)] : [])]
}
