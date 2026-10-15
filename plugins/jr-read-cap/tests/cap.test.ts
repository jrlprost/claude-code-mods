import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { countLines, isWholeRead } from '../hooks/cap'

test('only whole-file reads of text files are capped', async () => {
  expect(isWholeRead({ file_path: '/a/big.ts' }, true)).toBe(true)
  expect(isWholeRead({ file_path: '/a/big.ts', limit: 200 }, true)).toBe(false)
  expect(isWholeRead({ file_path: '/a/big.ts', offset: 10 }, true)).toBe(false)
  expect(isWholeRead({ file_path: '/a/shot.png' }, true)).toBe(false)
  expect(isWholeRead({ file_path: '/a/doc.pdf', pages: '1-3' }, true)).toBe(false)
  expect(isWholeRead({ file_path: '/a/big.ts', allow_large: true }, true)).toBe(false)
  expect(isWholeRead({ file_path: '/a/big.ts', allow_large: true }, false)).toBe(true)
})

test('lines are counted like an editor does', async () => {
  expect(countLines('')).toBe(0)
  expect(countLines('a\nb\n')).toBe(2)
  expect(countLines('a\nb')).toBe(2)
})

const files: Record<string, string> = {
  '/repo/long.ts': 'x\n'.repeat(2500),
  '/repo/short.ts': 'x\n'.repeat(40),
}

const machine = (on: On, ran: string[]) => {
  on('fs.stat', ($, e) => {
    const p = (e as unknown as { path: string }).path
    if (!(p in files)) throw new Error('ENOENT')
    return { value: { size: files[p]!.length, kind: 'file', mtimeMs: 0, isLink: false } } as never
  })
  on('fs.read', ($, e) => ({ value: files[(e as unknown as { path: string }).path] ?? '' }) as never)
  on('tool.call', ($, e) => {
    ran.push(String((e as unknown as { file_path?: string }).file_path))
    return { result: 'read' } as never
  })
}

test('a whole read of a long file is refused with a hint; short files and ranges pass', async ($, on) => {
  const ran: string[] = []
  machine(on, ran)
  const refused = await $.tool.call({ tool: 'Read', file_path: '/repo/long.ts' } as never)
  expect(refused.deny).toContain('2,500 lines')
  expect(refused.deny).toContain('offset and limit')
  const ranged = await $.tool.call({ tool: 'Read', file_path: '/repo/long.ts', offset: 100, limit: 200 } as never)
  expect(ranged.deny).toBeUndefined()
  const short = await $.tool.call({ tool: 'Read', file_path: '/repo/short.ts' } as never)
  expect(short.deny).toBeUndefined()
  expect(ran).toEqual(['/repo/long.ts', '/repo/short.ts'])
})

test('a file the mod cannot measure goes through to Read', async ($, on) => {
  const ran: string[] = []
  machine(on, ran)
  const r = await $.tool.call({ tool: 'Read', file_path: '/repo/missing.ts' } as never)
  expect(r.deny).toBeUndefined()
  expect(ran).toEqual(['/repo/missing.ts'])
})

test('the cap is configurable', { options: { maxLines: 3000 } } as never, async ($: never, on: On) => {
  const ran: string[] = []
  machine(on, ran)
  const r = await (($ as unknown as { tool: { call: (e: unknown) => Promise<{ deny?: string }> } }).tool.call({ tool: 'Read', file_path: '/repo/long.ts' }))
  expect(r.deny).toBeUndefined()
})
