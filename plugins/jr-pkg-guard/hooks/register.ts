import type { EngineInterface, Register } from 'claude-code'

import type { Finding, Wanted } from './parse'
import { readNpmDownloads, readNpmLatest, readRegistry, registryUrl, verdict, wantedPackages, WELL_USED } from './parse'

const HEADERS = { 'User-Agent': 'jr-pkg-guard (github.com/jrlprost/claude-code-mods)', Accept: 'application/json' }

/**
 * npm documents of popular packages weigh megabytes, so npm is read in steps: the small
 * `latest` manifest (exists? install scripts?), the monthly downloads, and the full document
 * only for quiet packages, which are small, to learn when they were first published.
 */
async function lookUpNpm($: EngineInterface, wanted: Wanted): Promise<Finding> {
  const base = registryUrl(wanted)
  const latest = readNpmLatest(...(await statusAndText($, `${base}/latest`)))
  if (!latest || !latest.exists) return { wanted, lookup: latest }
  const [, downloadsText] = await statusAndText($, `https://api.npmjs.org/downloads/point/last-month/${wanted.name}`)
  if (readNpmDownloads(downloadsText) >= WELL_USED) return { wanted, lookup: latest }
  const full = readRegistry(wanted, ...(await statusAndText($, base)))
  return { wanted, lookup: full ? { ...full, installScripts: latest.installScripts } : latest }
}

async function statusAndText($: EngineInterface, url: string): Promise<[number, string]> {
  const res = await $.http.fetch(url, { headers: HEADERS })
  return [res.status, res.text]
}

async function lookUp($: EngineInterface, wanted: Wanted): Promise<Finding> {
  try {
    if (wanted.ecosystem === 'npm') return await lookUpNpm($, wanted)
    return { wanted, lookup: readRegistry(wanted, ...(await statusAndText($, registryUrl(wanted)))) }
  } catch {
    return { wanted, lookup: null }
  }
}

export const register: Register = (on, options) => {
  const minDays = Number(options.minAgeDays ?? 30)
  const blockNew = (options.newPackages ?? 'block') === 'block'

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const wanted = wantedPackages(e.command)
    if (wanted.length === 0) return next(e)
    const findings: Finding[] = []
    for (const w of wanted.slice(0, 20)) findings.push(await lookUp($, w))
    const result = verdict(findings, await $.clock.now(), minDays, blockNew)
    if (result.deny) return { deny: result.deny }
    if (result.warnings.length) $.ui.toast(`jr pkg guard · ${result.warnings.join(' · ')}`)
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'jr-pkg-guard: the package check failed, so the install was held back.' }))
}
