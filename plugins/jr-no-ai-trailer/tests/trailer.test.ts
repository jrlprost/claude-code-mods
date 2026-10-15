import { test, expect } from 'claude-code/testing'

import { findAiTrailer, findGeneratedFooter, judge } from '../hooks/trailer'

const OPTS = { allowTrailer: false, blockFooter: true }
const AI_COMMIT = 'git commit -m "Fix login\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>"'
const HUMAN_COMMIT = 'git commit -m "Fix login\n\nCo-Authored-By: Jane Doe <jane@example.com>"'
const PR = 'gh pr create --title "Fix" --body "Done.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"'

test('an AI co-author line is found, a human one is not', async () => {
  expect(findAiTrailer(AI_COMMIT)).toContain('Claude Opus')
  expect(findAiTrailer(HUMAN_COMMIT)).toBe(null)
})

test('the generated footer is found', async () => {
  expect(findGeneratedFooter(PR)).toContain('Generated with')
})

test('commits with an AI trailer are refused, others pass', async () => {
  expect(judge(AI_COMMIT, OPTS)?.deny).toContain('AI co-author line')
  expect(judge(HUMAN_COMMIT, OPTS)).toBe(null)
  expect(judge('git status', OPTS)).toBe(null)
  expect(judge('echo "Co-Authored-By: Claude"', OPTS)).toBe(null)
})

test('pull request footers are refused unless turned off', async () => {
  expect(judge(PR, OPTS)?.deny).toContain('AI footer')
  expect(judge(PR, { ...OPTS, blockFooter: false })).toBe(null)
})

test('the setting lets trailers through', async () => {
  expect(judge(AI_COMMIT, { allowTrailer: true, blockFooter: false })).toBe(null)
})

test('the guard refuses the Bash call before it runs', async ($, on) => {
  on('tool.call', () => ({ result: 'ran' }) as never)
  const refused = await $.tool.call({ tool: 'Bash', command: AI_COMMIT } as never)
  expect((refused as { deny?: string }).deny).toContain('AI co-author line')
  const passed = await $.tool.call({ tool: 'Bash', command: 'git commit -m "Fix login"' } as never)
  expect((passed as { deny?: string }).deny).toBeUndefined()
})
