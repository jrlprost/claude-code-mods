import { test, expect } from 'claude-code/testing'

import { PERSONAL_RULES, redactText, redactValue, SECRET_RULES } from '../hooks/redact'

const FAKE = {
  // Fake values, assembled at run time so secret scanners do not flag this file.
  anthropic: 'sk-ant-api03-' + 'a'.repeat(40),
  openai: 'sk-proj-' + 'B'.repeat(40),
  stripe: 'sk_live_' + '4'.repeat(24),
  github: 'ghp_' + 'c'.repeat(36),
  aws: 'AKIA' + 'ABCDEFGHIJKLMNOP',
  google: 'AIza' + 'd'.repeat(35),
  slack: 'xoxb-' + '1234567890-abcdef',
  // Built from pieces so secret scanners do not flag this test file.
  jwt: ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIn0', 'dozjgNry' + 'P4J3jVmNHl0w5N'].join('.'),
}

test('each secret format becomes a named placeholder', async () => {
  const counts: Record<string, number> = {}
  const out = redactText(Object.values(FAKE).join('\n'), SECRET_RULES, counts)
  for (const secret of Object.values(FAKE)) expect(out).not.toContain(secret)
  expect(out).toContain('[REDACTED:anthropic-key]')
  expect(out).toContain('[REDACTED:openai-key]')
  expect(out).toContain('[REDACTED:stripe-key]')
  expect(counts['github-token']).toBe(1)
})

test('a connection string keeps its host, loses its password', async () => {
  const out = redactText('DATABASE_URL=postgres://app:s3cr3t-pw@db.internal:5432/main', SECRET_RULES, {})
  expect(out).toBe('DATABASE_URL=postgres://app:[REDACTED:password]@db.internal:5432/main')
})

test('private keys are removed whole', async () => {
  const pem = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAA\n-----END OPENSSH PRIVATE KEY-----'
  expect(redactText(`key:\n${pem}\nend`, SECRET_RULES, {})).toBe('key:\n[REDACTED:private-key]\nend')
})

test('emails and IPs only when asked', async () => {
  const line = 'contact jane@example.com from 10.0.0.12'
  expect(redactText(line, SECRET_RULES, {})).toBe(line)
  expect(redactText(line, [...SECRET_RULES, ...PERSONAL_RULES], {})).toBe('contact [REDACTED:email] from [REDACTED:ip]')
})

test('ordinary text is left alone', async () => {
  const text = 'const skip = task-runner; see https://github.com/x/y; sk-short'
  expect(redactText(text, SECRET_RULES, {})).toBe(text)
})

test('a tool result keeps its shape, every string redacted', async () => {
  const counts: Record<string, number> = {}
  const result = redactValue({ stdout: `TOKEN=${FAKE.github}`, stderr: '', interrupted: false }, SECRET_RULES, counts)
  expect(result).toEqual({ stdout: 'TOKEN=[REDACTED:github-token]', stderr: '', interrupted: false })
})

test('the model reads the redacted result, the tool ran unchanged', async ($, on) => {
  on('ui.toast', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: { stdout: `STRIPE=${FAKE.stripe}`, stderr: '', interrupted: false } }) as never)
  const r = (await $.tool.call({ tool: 'Bash', command: 'cat .env' } as never)) as { result?: { stdout: string } }
  expect(r.result?.stdout).toBe('STRIPE=[REDACTED:stripe-key]')
})
