// Which packages a shell command installs, per ecosystem.

export type Ecosystem = 'npm' | 'pypi' | 'crates' | 'rubygems'
export type Wanted = { ecosystem: Ecosystem; name: string }

const segments = (command: string) => command.split(/&&|\|\||;|\||\n/).map(s => s.trim()).filter(Boolean)

const words = (segment: string) =>
  (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(w => w.replace(/^["']|["']$/g, ''))

const isLocal = (w: string) =>
  /^(\.{1,2}\/|\/|~\/|file:|git\+|git:|https?:|github:|workspace:|link:|portal:)/.test(w) || /\.(tgz|tar\.gz|whl|zip|gem)$/.test(w)

/** `react@18`, `@scope/pkg@^1` → the bare name. */
const npmName = (w: string) => (w.startsWith('@') ? `@${w.slice(1).split('@')[0]}` : w.split('@')[0]) ?? w

/** `requests==2.31`, `uvicorn[standard]>=0.2` → the bare name. */
const pypiName = (w: string) => w.split(/[\[<>=!~;@ ]/)[0] ?? w

const after = (ws: string[], i: number) => ws.slice(i).filter(w => !w.startsWith('-'))

export const wantedPackages = (command: string): Wanted[] => {
  const out: Wanted[] = []
  for (const segment of segments(command)) {
    const all = words(segment)
    let lead = 0
    while (lead < all.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(all[lead] ?? '')) lead++ // leading ENV=value
    const ws = all.slice(lead)
    const [tool, verb, third] = ws
    const add = (ecosystem: Ecosystem, names: string[]) => {
      for (const n of names) if (n && !isLocal(n)) out.push({ ecosystem, name: n })
    }
    if (tool === 'npm' && (verb === 'install' || verb === 'i' || verb === 'add')) add('npm', after(ws, 2).map(npmName))
    else if ((tool === 'pnpm' || tool === 'yarn' || tool === 'bun') && (verb === 'add' || verb === 'install' || verb === 'i'))
      add('npm', after(ws, 2).map(npmName))
    else if ((tool === 'pip' || tool === 'pip3' || tool === 'pipx') && verb === 'install') {
      const skip = new Set<number>()
      ws.forEach((w, i) => {
        if (w === '-r' || w === '--requirement' || w === '-e' || w === '--editable' || w === '-c') skip.add(i + 1)
      })
      add('pypi', ws.slice(2).filter((w, i) => !w.startsWith('-') && !skip.has(i + 2)).map(pypiName))
    } else if (tool === 'python' || tool === 'python3') {
      if (verb === '-m' && third === 'pip' && ws[3] === 'install') add('pypi', after(ws, 4).map(pypiName))
    } else if (tool === 'uv' && verb === 'add') add('pypi', after(ws, 2).map(pypiName))
    else if (tool === 'uv' && verb === 'pip' && third === 'install') add('pypi', after(ws, 3).map(pypiName))
    else if (tool === 'poetry' && verb === 'add') add('pypi', after(ws, 2).map(pypiName))
    else if (tool === 'cargo' && (verb === 'add' || verb === 'install')) add('crates', after(ws, 2).map(w => w.split('@')[0] ?? w))
    else if (tool === 'gem' && verb === 'install') add('rubygems', after(ws, 2))
  }
  return out
}

export type Lookup = { exists: boolean; firstPublished?: number; installScripts?: string[] }

/** The registry URL that answers whether a package exists and since when. */
export const registryUrl = (w: Wanted) => {
  const n = encodeURIComponent(w.name).replace('%40', '@')
  switch (w.ecosystem) {
    case 'npm':
      return `https://registry.npmjs.org/${w.name.startsWith('@') ? `@${encodeURIComponent(w.name.slice(1))}` : n}`
    case 'pypi':
      return `https://pypi.org/pypi/${n}/json`
    case 'crates':
      return `https://crates.io/api/v1/crates/${n}`
    case 'rubygems':
      return `https://rubygems.org/api/v1/versions/${n}.json`
  }
}

/** npm's small `<name>/latest` manifest: whether the package exists, and its install scripts. */
export const readNpmLatest = (status: number, body: string): Lookup | null => {
  if (status === 404) return { exists: false }
  if (status < 200 || status >= 300) return null
  try {
    const scripts = (JSON.parse(body) as { scripts?: Record<string, string> }).scripts ?? {}
    return { exists: true, installScripts: ['preinstall', 'install', 'postinstall'].filter(k => scripts[k]) }
  } catch {
    return null
  }
}

export const readNpmDownloads = (body: string) => {
  try {
    return Number((JSON.parse(body) as { downloads?: number }).downloads ?? 0)
  } catch {
    return 0
  }
}

/** Packages with this many downloads a month are not new; only quieter ones get their full (small) document read. */
export const WELL_USED = 5000

/** Reads a registry answer: existence, the first publication date, npm install scripts. */
export const readRegistry = (w: Wanted, status: number, body: string): Lookup | null => {
  if (status === 404) return { exists: false }
  if (status < 200 || status >= 300) return null
  try {
    const json = JSON.parse(body) as Record<string, unknown>
    if (w.ecosystem === 'npm') {
      const time = json.time as Record<string, string> | undefined
      const latest = (json['dist-tags'] as Record<string, string> | undefined)?.latest
      const scripts = latest ? ((json.versions as Record<string, { scripts?: Record<string, string> }>)?.[latest]?.scripts ?? {}) : {}
      const installScripts = ['preinstall', 'install', 'postinstall'].filter(k => scripts[k])
      return { exists: true, firstPublished: time?.created ? Date.parse(time.created) : undefined, installScripts }
    }
    if (w.ecosystem === 'pypi') {
      const releases = json.releases as Record<string, { upload_time_iso_8601?: string }[]> | undefined
      const times = Object.values(releases ?? {})
        .flat()
        .map(f => Date.parse(f.upload_time_iso_8601 ?? ''))
        .filter(Number.isFinite)
      return { exists: true, firstPublished: times.length ? Math.min(...times) : undefined }
    }
    if (w.ecosystem === 'crates') {
      const created = (json.crate as { created_at?: string } | undefined)?.created_at
      return { exists: true, firstPublished: created ? Date.parse(created) : undefined }
    }
    const versions = JSON.parse(body) as { created_at?: string }[]
    const times = versions.map(v => Date.parse(v.created_at ?? '')).filter(Number.isFinite)
    return { exists: true, firstPublished: times.length ? Math.min(...times) : undefined }
  } catch {
    return null
  }
}

export type Finding = { wanted: Wanted; lookup: Lookup | null }

export const ageDays = (lookup: Lookup | null, now: number) =>
  lookup?.firstPublished ? Math.floor((now - lookup.firstPublished) / 86_400_000) : undefined

export const verdict = (findings: Finding[], now: number, minDays: number, blockNew: boolean) => {
  const label = (f: Finding) => `${f.wanted.name} (${f.wanted.ecosystem})`
  const missing = findings.filter(f => f.lookup && !f.lookup.exists)
  const fresh = findings.filter(f => {
    const age = ageDays(f.lookup, now)
    return f.lookup?.exists && age !== undefined && age < minDays
  })
  const scripted = findings.filter(f => f.lookup?.installScripts?.length)
  const unchecked = findings.filter(f => !f.lookup)
  const reasons: string[] = []
  if (missing.length) reasons.push(`${missing.map(label).join(', ')} ${missing.length > 1 ? 'do' : 'does'} not exist on the registry: likely a hallucinated or typosquatted name. Check the exact package name.`)
  if (blockNew && fresh.length)
    reasons.push(`${fresh.map(f => `${label(f)}, first published ${ageDays(f.lookup, now)} days ago`).join('; ')}. Packages younger than ${minDays} days are held back; check the author and repository first.`)
  const warnings: string[] = []
  if (!blockNew && fresh.length) warnings.push(`new package: ${fresh.map(f => `${f.wanted.name} (${ageDays(f.lookup, now)} d)`).join(', ')}`)
  if (scripted.length) warnings.push(`install scripts: ${scripted.map(f => `${f.wanted.name} (${f.lookup!.installScripts!.join(', ')})`).join(', ')}`)
  if (unchecked.length) warnings.push(`not checked (registry unreachable): ${unchecked.map(f => f.wanted.name).join(', ')}`)
  return { deny: reasons.length ? `jr-pkg-guard: ${reasons.join(' ')}` : null, warnings }
}
