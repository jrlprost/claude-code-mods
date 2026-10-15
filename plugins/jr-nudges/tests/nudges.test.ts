import { test, expect } from 'claude-code/testing'

import { addedLines, countAdded, countChange, countFile, isCode, message } from '../hooks/nudges'

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,3 @@
-const a = 1
+const a = 2
+console.log('a', a)
+// TODO handle the empty cart
@@ -9 +11 @@
+  debugger
`

test('only added lines count', async () => {
  expect(countAdded(DIFF)).toEqual({ debug: 2, markers: 1 })
  expect(countAdded('-console.log(x)\n')).toEqual({ debug: 0, markers: 0 })
})

test('a new file counts every line', async () => {
  expect(countFile('print("hi")\n# FIXME later\nx = 1')).toEqual({ debug: 1, markers: 1 })
})

test('only what the turn added counts, not what was already there', async () => {
  const before = "console.log('old')\nconst a = 1"
  const after = "console.log('old')\nconst a = 2\nconsole.log('new')\n// TODO later"
  expect(addedLines(before, after)).toEqual(['const a = 2', "console.log('new')", '// TODO later'])
  expect(countChange(before, after)).toEqual({ debug: 1, markers: 1 })
})

test('code files only', async () => {
  expect(isCode('/w/src/a.tsx')).toBe(true)
  expect(isCode('/w/README.md')).toBe(false)
})

test('quiet when nothing was added', async () => {
  expect(message(0, 0)).toBe(null)
  expect(message(2, 1)).toBe('jr nudges · this turn added 2 debug statements (console.log, print, debugger…) and 1 TODO/FIXME/HACK')
})

test('a turn that adds a console.log ends with one toast', async ($, on) => {
  const toasts: string[] = []
  on('turn.start', () => ({ turnId: 't1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  const files: Record<string, string> = { '/w/src/a.ts': 'const a = 1', '/w/README.md': 'hi' }
  on('fs.exists', ($, e) => ({ value: (e as unknown as { path: string }).path in files }) as never)
  on('fs.read', ($, e) => ({ value: files[(e as unknown as { path: string }).path] ?? '' }) as never)
  on('tool.call', ($, e) => {
    const call = e as unknown as { file_path: string }
    files[call.file_path] = "const a = 2\nconsole.log('a', a)\ndebugger"
    return { result: 'ok' } as never
  })
  on('ui.toast', ($, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/src/a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/w/README.md', old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', text: '', reason: 'answer' } as never)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('2 debug statements')
})
