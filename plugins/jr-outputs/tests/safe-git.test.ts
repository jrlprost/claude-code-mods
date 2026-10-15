import { test, expect } from 'claude-code/testing'

import { safeGit } from '../hooks/jr/git'

test('git runs with the repo config that could run programs switched off', async () => {
  expect(safeGit(['-C', '/repo', 'diff', '--numstat', 'HEAD'])).toEqual([
    'git',
    '-c', 'core.fsmonitor=false',
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'core.pager=cat',
    '-c', 'diff.external=',
    '-c', 'core.untrackedCache=false',
    '-c', 'protocol.ext.allow=never',
    '-C', '/repo',
    'diff', '--no-ext-diff', '--no-textconv', '--numstat', 'HEAD',
  ])
})
