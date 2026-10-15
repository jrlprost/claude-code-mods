import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { appendLine, httpFailure, optionsOf, planFor } from '../hooks/targets'

const base = optionsOf({})

test('markdown by default: TODO.md at the project root', async () => {
  expect(planFor('ship it', base, '/work/app')).toEqual({ kind: 'append', file: '/work/app/TODO.md', line: '- [ ] ship it', describe: 'TODO.md' })
  expect(planFor('x', { ...base, file: 'docs/tasks.md' }, '/work/app')).toMatchObject({ file: '/work/app/docs/tasks.md' })
})

test('lines are appended on their own line', async () => {
  expect(appendLine('', '- [ ] a')).toBe('- [ ] a\n')
  expect(appendLine('# Todo\n- [ ] a', '- [ ] b')).toBe('# Todo\n- [ ] a\n- [ ] b\n')
})

test('Todoist v1, Linear without Bearer, Notion with its version header', async () => {
  const todoist = planFor('a', { ...base, target: 'todoist', todoistToken: 't' }, '/r')
  expect(todoist).toMatchObject({ url: 'https://api.todoist.com/api/v1/tasks', init: { headers: { Authorization: 'Bearer t' } } })
  const linear = planFor('a', { ...base, target: 'linear', linearKey: 'lin_api_x', linearTeamId: 'team' }, '/r')
  expect(linear).toMatchObject({ url: 'https://api.linear.app/graphql', init: { headers: { Authorization: 'lin_api_x' } } })
  const notion = planFor('a', { ...base, target: 'notion', notionToken: 'n', notionDatabaseId: 'db' }, '/r')
  expect(notion).toMatchObject({ init: { headers: { 'Notion-Version': '2022-06-28' } } })
  expect(JSON.parse((notion as { init: { body: string } }).init.body).properties.Name.title[0].text.content).toBe('a')
})

test('missing credentials are named, nothing is sent', async () => {
  expect(planFor('a', { ...base, target: 'linear', linearKey: 'k' }, '/r')).toEqual({ kind: 'missing', what: 'a Linear API key and team id' })
  expect(planFor('a', { ...base, target: 'custom', command: 'no placeholder' }, '/r')).toMatchObject({ kind: 'missing' })
})

test('the task never becomes shell code', async () => {
  const custom = planFor('x"; rm -rf ~; echo "', { ...base, target: 'custom', command: 'tasks add {task}' }, '/r')
  expect(custom).toEqual({ kind: 'process', argv: ['sh', '-c', 'tasks add "$1"', 'jrtodo', 'x"; rm -rf ~; echo "'], describe: 'your command' })
  const reminders = planFor('call "Bob"', { ...base, target: 'reminders' }, '/r') as { argv: string[] }
  expect(reminders.argv[reminders.argv.length - 1]).toBe('call "Bob"')
  expect(reminders.argv.slice(0, -1).join(' ')).not.toContain('Bob')
})

test('Linear errors inside a 200 are failures', async () => {
  expect(httpFailure(200, true, '{"errors":[{"message":"Team not found"}]}')).toBe('Team not found')
  expect(httpFailure(200, true, '{"data":{"issueCreate":{"success":true}}}')).toBe(null)
  expect(httpFailure(401, false, '')).toBe('HTTP 401')
})

const machine = (on: On, files: Record<string, string>) => {
  on('session.root', () => ({ value: '/work/app' }) as never)
  on('fs.read', (_$, e) => {
    const p = (e as unknown as { path: string }).path
    if (!(p in files)) throw new Error('missing')
    return { value: files[p] } as never
  })
  on('fs.write', (_$, e) => {
    const w = e as unknown as { path: string; text: string }
    files[w.path] = w.text
    return { value: undefined } as never
  })
}

test('/jrtodo appends to TODO.md, creating it when needed', async ($, on) => {
  const files: Record<string, string> = {}
  machine(on, files)
  const first = await $.command.run({ command: 'jrtodo', args: 'call the accountant' } as never)
  await $.command.run({ command: 'jrtodo', args: 'renew the domain' } as never)
  expect(files['/work/app/TODO.md']).toBe('- [ ] call the accountant\n- [ ] renew the domain\n')
  expect(JSON.stringify(first)).toContain('✓')
})

test('/jrtodo with nothing shows the usage', async ($, on) => {
  machine(on, {})
  expect(JSON.stringify(await $.command.run({ command: 'jrtodo', args: ' ' } as never))).toContain('usage')
})
