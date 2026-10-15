import { test, expect } from 'claude-code/testing'

import { isRiskyGitConfig, safeGit } from '../hooks/jr/git'

test('git runs with the config that could run programs switched off', async () => {
  const argv = safeGit(['-C', '/repo', 'diff', '--numstat', 'HEAD'])
  expect(argv.slice(0, 3)).toEqual(['git', '-c', 'core.fsmonitor=false'])
  expect(argv).toContain('core.sshCommand=false')
  expect(argv).toContain('credential.helper=')
  expect(argv.slice(-7)).toEqual(['-C', '/repo', 'diff', '--no-ext-diff', '--no-textconv', '--numstat', 'HEAD'])
})

const PLAIN = `[core]
\trepositoryformatversion = 0
\tbare = false
[remote "origin"]
\turl = git@github.com:someone/app.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
`

test('a plain repo config is safe', async () => {
  expect(isRiskyGitConfig(PLAIN, '*.png binary\n')).toBe(false)
})

test('config that can run a program is risky', async () => {
  expect(isRiskyGitConfig(PLAIN + '[core]\n\tfsmonitor = ./pwn.sh\n')).toBe(true)
  expect(isRiskyGitConfig(PLAIN + '[core]\n\tsshCommand = sh -c evil\n')).toBe(true)
  expect(isRiskyGitConfig(PLAIN + '[filter "x"]\n\tclean = ./pwn.sh\n')).toBe(true)
  expect(isRiskyGitConfig(PLAIN + '[include]\n\tpath = ../other.cfg\n')).toBe(true)
  expect(isRiskyGitConfig(PLAIN + '[includeIf "gitdir:/x/"]\n\tpath = y\n')).toBe(true)
  expect(isRiskyGitConfig(PLAIN + '[diff "pdf"]\n\ttextconv = pdftotext\n')).toBe(true)
})

test('attributes naming a filter or diff driver are risky', async () => {
  expect(isRiskyGitConfig(PLAIN, '*.txt filter=x\n')).toBe(true)
  expect(isRiskyGitConfig(PLAIN, '*.pdf diff=pdf\n')).toBe(true)
})
