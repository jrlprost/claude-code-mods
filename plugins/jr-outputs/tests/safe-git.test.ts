import { test, expect } from 'claude-code/testing'

import { parseConfigListing, riskyEntries, safeGit } from '../hooks/jr/git'

test('git runs with the config that could run programs switched off', async () => {
  const argv = safeGit(['-C', '/repo', 'diff', '--numstat', 'HEAD'])
  expect(argv.slice(0, 3)).toEqual(['git', '-c', 'core.fsmonitor=false'])
  expect(argv).toContain('core.sshCommand=false')
  expect(argv).toContain('credential.helper=')
  expect(argv).toContain('submodule.recurse=false')
  expect(argv.slice(-8)).toEqual(['-C', '/repo', 'diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', '--numstat', 'HEAD'])
})

// What `git config --list --show-origin -z` prints: origin NUL key LF value NUL.
const listing = (...rows: [string, string, string][]) => rows.map(([o, k, v]) => `${o}\0${k}\n${v}\0`).join('')
const GLOBAL = 'file:/home/me/.gitconfig'
const TRUSTED = new Set([GLOBAL, 'file:/etc/gitconfig'])

test('the listing is read the way git prints it', async () => {
  expect(parseConfigListing(listing(['file:.git/config', 'core.bare', 'false'], [GLOBAL, 'user.name', 'Me']))).toEqual([
    { origin: 'file:.git/config', key: 'core.bare', value: 'false' },
    { origin: GLOBAL, key: 'user.name', value: 'Me' },
  ])
})

test('a plain repository is safe, and the person\'s own filters (git-lfs) are trusted', async () => {
  const entries = parseConfigListing(
    listing(['file:.git/config', 'core.bare', 'false'], ['file:.git/config', 'remote.origin.url', 'git@x:y.git'], [GLOBAL, 'filter.lfs.clean', 'git-lfs clean -- %f']),
  )
  expect(riskyEntries(entries, TRUSTED)).toEqual([])
})

test('anything able to run a program from the repository, or from a file it includes, is risky', async () => {
  for (const [origin, key] of [
    ['file:.git/config', 'core.fsmonitor'],
    ['file:.git/config', 'core.sshcommand'],
    ['file:.git/config', 'filter.x.clean'],
    ['file:.git/config', 'diff.pdf.textconv'],
    ['file:.git/config', 'alias.st'],
    ['file:.git/config', 'include.path'],
    ['file:.git/config.worktree', 'core.pager'],
    ['file:/tmp/pulled-in.cfg', 'credential.helper'],
  ] as const) {
    expect(riskyEntries(parseConfigListing(listing([origin, key, 'x'])), TRUSTED).length).toBe(1)
  }
})
