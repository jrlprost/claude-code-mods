import { test, expect, mock } from 'claude-code/testing'

import { isTooLarge, parseSips } from '../hooks/image'

test('sips output gives the size', async () => {
  expect(parseSips('/a.png\n  pixelWidth: 9000\n  pixelHeight: 200\n')).toEqual([9000, 200])
  expect(parseSips('nope')).toBe(null)
})

test('either axis over the limit is too large', async () => {
  expect(isTooLarge([9000, 200], 7800)).toBe(true)
  expect(isTooLarge([200, 8000], 7800)).toBe(true)
  expect(isTooLarge([7800, 7800], 7800)).toBe(false)
  expect(isTooLarge(null, 7800)).toBe(false)
})

test('a big image is read through a resized copy, a small one as is', async ($, on) => {
  mock.clock(on)
  const read: string[] = []
  let width = 9000
  on('process.run', ($, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    const stdout = argv[0] === 'sips' && argv[1] === '-g' ? `pixelWidth: ${width}\npixelHeight: 300\n` : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)
  on('tool.call', ($, e) => {
    read.push((e as unknown as { file_path: string }).file_path)
    return { result: 'ok' } as never
  })
  await $.tool.call({ tool: 'Read', file_path: '/shots/full.png' } as never)
  width = 1200
  await $.tool.call({ tool: 'Read', file_path: '/shots/small.png' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/notes.md' } as never)
  expect(read[0]).toMatch(/^\/tmp\/jr-image-guard\/\d+-full\.png$/)
  expect(read.slice(1)).toEqual(['/shots/small.png', '/notes.md'])
})

test('an oversized browser viewport is refused', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }) as never)
  const r = await $.tool.call({ tool: 'mcp__playwright__browser_resize', width: 1400, height: 9000 } as never)
  expect((r as { deny?: string }).deny).toContain('over 7800 px')
})
