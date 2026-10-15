import type { JrDictationSegment } from '../types'

// Unicode word edges: \b does not see accented letters.
const bounded = (source: string) => `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`

/**
 * Rewrites every dictionary match in one pass, left to right, and keeps the pieces so the
 * prompt row can show what was removed and what was added. Null when nothing changed.
 */
export const normalize = (text: string, dictionary: ReadonlyArray<readonly [string, string]>) => {
  const valid = dictionary.filter(([pattern]) => {
    try {
      new RegExp(bounded(pattern), 'iu')
      return true
    } catch {
      return false
    }
  })
  if (valid.length === 0) return null
  const rules = valid.map(([pattern, replacement]) => ({ exact: new RegExp(`^${bounded(pattern)}$`, 'iu'), replacement }))
  const any = new RegExp(valid.map(([pattern]) => bounded(pattern)).join('|'), 'giu')

  const segments: JrDictationSegment[] = []
  let corrected = ''
  let cursor = 0
  for (const match of text.matchAll(any)) {
    const found = match[0]
    const replacement = rules.find(rule => rule.exact.test(found))?.replacement
    if (replacement === undefined || replacement === found) continue
    const before = text.slice(cursor, match.index)
    if (before) segments.push({ kind: 'same', text: before })
    segments.push({ kind: 'removed', text: found }, { kind: 'added', text: replacement })
    corrected += before + replacement
    cursor = match.index + found.length
  }
  if (cursor === 0) return null
  const rest = text.slice(cursor)
  if (rest) segments.push({ kind: 'same', text: rest })
  return { corrected: corrected + rest, segments }
}
