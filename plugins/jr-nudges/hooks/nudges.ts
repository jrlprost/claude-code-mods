const CODE = /\.(m?[jt]sx?|cjs|py|rb|go|rs|java|kt|swift|php|c|cc|cpp|h|hpp|cs|scala|dart|lua|vue|svelte)$/i

export const isCode = (file: string) => CODE.test(file)

const DEBUG = /\b(console\.(log|debug|trace|dir)\s*\(|debugger\b|dbg!\s*\(|\bprint\s*\(|var_dump\s*\(|fmt\.Println\s*\()/
const MARKER = /\b(TODO|FIXME|HACK|XXX)\b/

/** Counts debug statements and TODO-style markers on the lines a unified diff adds. */
export const countAdded = (diff: string) => {
  let debug = 0
  let markers = 0
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const body = line.slice(1)
    if (DEBUG.test(body)) debug++
    if (MARKER.test(body)) markers++
  }
  return { debug, markers }
}

/** Counts in a new file, where every line is added. */
export const countFile = (text: string) => countAdded(text.split('\n').map(l => `+${l}`).join('\n'))

/** Lines of `after` that were not in `before` (as a multiset): what the turn added to the file. */
export const addedLines = (before: string, after: string) => {
  const left = new Map<string, number>()
  for (const line of before.split('\n')) left.set(line, (left.get(line) ?? 0) + 1)
  const added: string[] = []
  for (const line of after.split('\n')) {
    const n = left.get(line) ?? 0
    if (n > 0) left.set(line, n - 1)
    else added.push(line)
  }
  return added
}

export const countChange = (before: string, after: string) => countFile(addedLines(before, after).join('\n'))

export const message = (debug: number, markers: number) => {
  const parts: string[] = []
  if (debug) parts.push(`${debug} debug statement${debug > 1 ? 's' : ''} (console.log, print, debugger…)`)
  if (markers) parts.push(`${markers} TODO/FIXME/HACK`)
  return parts.length ? `jr nudges · this turn added ${parts.join(' and ')}` : null
}
