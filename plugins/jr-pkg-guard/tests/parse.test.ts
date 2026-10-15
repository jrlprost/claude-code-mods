import { test, expect, mock } from 'claude-code/testing'

import { readRegistry, registryUrl, verdict, wantedPackages } from '../hooks/parse'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-16T00:00:00Z')

test('install commands of every ecosystem are read, flags and local paths skipped', async () => {
  expect(wantedPackages('npm i -D react@18 @types/node@^20 /tmp/local.tgz && echo ok').map(w => w.name)).toEqual(['react', '@types/node'])
  expect(wantedPackages('pnpm add zod').map(w => w.name)).toEqual(['zod'])
  expect(wantedPackages('pip install -r reqs.txt requests==2.31 "uvicorn[standard]>=0.2"').map(w => w.name)).toEqual(['requests', 'uvicorn'])
  expect(wantedPackages('python3 -m pip install httpx').map(w => `${w.ecosystem}:${w.name}`)).toEqual(['pypi:httpx'])
  expect(wantedPackages('uv add fastapi; cargo add serde@1; gem install rails').map(w => `${w.ecosystem}:${w.name}`)).toEqual([
    'pypi:fastapi',
    'crates:serde',
    'rubygems:rails',
  ])
  expect(wantedPackages('CI=1 npm i left-pad').map(w => w.name)).toEqual(['left-pad'])
  expect(wantedPackages('npm install')).toEqual([])
  expect(wantedPackages('npm run build')).toEqual([])
})

test('registry URLs per ecosystem', async () => {
  expect(registryUrl({ ecosystem: 'npm', name: '@types/node' })).toBe('https://registry.npmjs.org/@types%2Fnode')
  expect(registryUrl({ ecosystem: 'pypi', name: 'requests' })).toBe('https://pypi.org/pypi/requests/json')
})

test('npm answers give the creation date and install scripts', async () => {
  const body = JSON.stringify({ time: { created: '2026-10-10T00:00:00Z' }, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': { scripts: { postinstall: 'node x' } } } })
  expect(readRegistry({ ecosystem: 'npm', name: 'x' }, 200, body)).toEqual({ exists: true, firstPublished: Date.parse('2026-10-10T00:00:00Z'), installScripts: ['postinstall'] })
  expect(readRegistry({ ecosystem: 'npm', name: 'x' }, 404, '')).toEqual({ exists: false })
})

test('missing packages are refused, new ones refused or warned per setting', async () => {
  const missing = { wanted: { ecosystem: 'npm' as const, name: 'reakt-dom-utils' }, lookup: { exists: false } }
  const fresh = { wanted: { ecosystem: 'npm' as const, name: 'brand-new' }, lookup: { exists: true, firstPublished: NOW - 3 * DAY } }
  const old = { wanted: { ecosystem: 'npm' as const, name: 'react' }, lookup: { exists: true, firstPublished: NOW - 3000 * DAY } }
  expect(verdict([missing, old], NOW, 30, true).deny).toContain('does not exist')
  expect(verdict([fresh], NOW, 30, true).deny).toContain('first published 3 days ago')
  const warned = verdict([fresh], NOW, 30, false)
  expect(warned.deny).toBe(null)
  expect(warned.warnings[0]).toContain('brand-new (3 d)')
  expect(verdict([old], NOW, 30, true)).toEqual({ deny: null, warnings: [] })
})

test('the guard holds back an install of a package that does not exist', async ($, on) => {
  mock.clock(on, { now: NOW })
  const ran: string[] = []
  on('http.fetch', ($, e) => {
    const url = (e as unknown as { url: string }).url
    const status = url.includes('reakt') ? 404 : 200
    const text = url.includes('downloads') ? JSON.stringify({ downloads: 900_000_000 }) : JSON.stringify({ scripts: {} })
    return { value: { status, ok: status === 200, headers: {}, text } } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)
  on('tool.call', ($, e) => {
    ran.push((e as unknown as { command: string }).command)
    return { result: 'ok' } as never
  })
  const refused = await $.tool.call({ tool: 'Bash', command: 'npm install reakt-dom-utils' } as never)
  expect((refused as { deny?: string }).deny).toContain('does not exist')
  await $.tool.call({ tool: 'Bash', command: 'npm install react' } as never)
  expect(ran).toEqual(['npm install react'])
})

test('a quiet npm package gets its full document read for its age', async ($, on) => {
  mock.clock(on, { now: NOW })
  const urls: string[] = []
  on('http.fetch', ($, e) => {
    const url = (e as unknown as { url: string }).url
    urls.push(url)
    const text = url.endsWith('/latest')
      ? JSON.stringify({ scripts: { postinstall: 'node steal.js' } })
      : url.includes('downloads')
        ? JSON.stringify({ downloads: 12 })
        : JSON.stringify({ time: { created: '2026-10-14T00:00:00Z' }, 'dist-tags': { latest: '0.0.1' }, versions: { '0.0.1': {} } })
    return { value: { status: 200, ok: true, headers: {}, text } } as never
  })
  on('tool.call', () => ({ result: 'ok' }) as never)
  const refused = await $.tool.call({ tool: 'Bash', command: 'npm i shiny-new-thing' } as never)
  expect((refused as { deny?: string }).deny).toContain('first published 2 days ago')
  expect(urls.length).toBe(3)
})
