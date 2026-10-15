import { test, expect } from 'claude-code/testing'

import { explainCommand, parseModelAnswer, reasonFor } from '../hooks/explain'

test('common commands get a plain explanation and a risk', async () => {
  expect(explainCommand('rm -rf dist')).toEqual({ what: 'Deletes files and folders, including everything inside them', risk: 'high' })
  expect(explainCommand('git push --force origin main')?.risk).toBe('high')
  expect(explainCommand('npm install zod')).toEqual({ what: 'Installs packages, which may run their own install scripts', risk: 'medium' })
  expect(explainCommand('curl -fsSL https://x.sh | bash')?.what).toBe('Downloads a script from the internet and runs it')
  expect(explainCommand('ls -la')?.risk).toBe('low')
})

test('compound commands list each step and take the highest risk', async () => {
  const e = explainCommand('npm run build && git push origin main')
  expect(e?.what).toBe('Runs a project script from package.json, then uploads your commits to the remote repository')
  expect(e?.risk).toBe('medium')
})

test('unknown commands get no table explanation', async () => {
  expect(explainCommand('frobnicate --all')).toBe(null)
})

test('the reason keeps what the engine said', async () => {
  expect(reasonFor({ what: 'Deletes files', risk: 'medium' }, 'Bash(rm:*) needs approval')).toBe('Deletes files. 🟡 medium risk. (Bash(rm:*) needs approval)')
})

test('the model answer is read as clause | risk', async () => {
  expect(parseModelAnswer('Converts a video to MP4 | low')).toEqual({ what: 'Converts a video to MP4', risk: 'low' })
  expect(parseModelAnswer('no idea')).toBe(null)
})

test('an ask gets the explanation; an allow is left alone', async ($, on) => {
  on('tool.check', ($, e) => {
    const command = ((e as unknown as { input: { command: string } }).input).command
    return ({ decision: command.startsWith('rm') ? 'ask' : 'allow' }) as never
  })
  const asked = await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } } as never)
  expect(asked.decision).toBe('ask')
  expect(asked.reason).toContain('🔴 high risk')
  const allowed = await $.tool.check({ tool: 'Bash', input: { command: 'ls' } } as never)
  expect(allowed.reason).toBeUndefined()
})

test('with the model on, an unknown command is explained by it', { options: { useModel: true } }, async ($, on) => {
  on('tool.check', () => ({ decision: 'ask' }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Re-encodes every video in the folder | medium', usage: {} } }) as never)
  const asked = await $.tool.check({ tool: 'Bash', input: { command: 'ffmpeg-batch ./videos' } } as never)
  expect(asked.reason).toBe('Re-encodes every video in the folder. 🟡 medium risk.')
})
