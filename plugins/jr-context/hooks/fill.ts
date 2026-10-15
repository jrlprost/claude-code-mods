import type { JrContextFill } from '../types'

// One hue per category, in the order the engine lists them; messages usually come last.
export const SEGMENT_COLORS = ['#7f5af0', '#3da9fc', '#c084fc', '#2cb67d', '#f4d35e', '#ff5ca8', '#4fd6be', '#ff8c42']

export const segmentColor = (index: number, count: number) =>
  // The last used row (the conversation itself) always takes the warm accent.
  index === count - 1 ? '#ff8c42' : (SEGMENT_COLORS[index % (SEGMENT_COLORS.length - 1)] ?? '#7f5af0')

type Breakdown = {
  categories: readonly { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }[]
  totalTokens: number
  rawMaxTokens: number
  percentage: number
}

/** The engine's /context breakdown, reduced to what the bar draws. */
export const fillOf = (breakdown: Breakdown | undefined): JrContextFill | null => {
  if (!breakdown || breakdown.rawMaxTokens <= 0) return null
  return {
    used: breakdown.categories.filter(c => c.kind === 'used' && c.tokens > 0).map(c => ({ name: c.name.toLowerCase(), tokens: c.tokens })),
    total: breakdown.totalTokens,
    max: breakdown.rawMaxTokens,
    buffer: breakdown.categories.find(c => c.kind === 'buffer')?.tokens ?? 0,
    percent: breakdown.percentage,
  }
}

export type BarCell = { char: string; color: string; kind: 'used' | 'free' | 'buffer' }

/**
 * The stacked bar, `width` cells: each used category gets its share (at least one
 * cell when it holds anything), then the free space as a thin line, then the
 * compaction buffer as a dim block at the end.
 */
export const stackedBar = (fill: JrContextFill, width: number): BarCell[] => {
  const perCell = fill.max / width
  const bufferCells = fill.buffer > 0 ? Math.max(1, Math.round(fill.buffer / perCell)) : 0
  const cells: BarCell[] = []
  fill.used.forEach((segment, i) => {
    const n = Math.max(1, Math.round(segment.tokens / perCell))
    const color = segmentColor(i, fill.used.length)
    for (let k = 0; k < n && cells.length < width - bufferCells; k++) cells.push({ char: '█', color, kind: 'used' })
  })
  while (cells.length < width - bufferCells) cells.push({ char: '─', color: '#5c5f77', kind: 'free' })
  while (cells.length < width) cells.push({ char: '█', color: '#3b3d4f', kind: 'buffer' })
  return cells
}

export const share = (tokens: number, max: number) => {
  const p = (tokens / max) * 100
  if (p < 0.1) return '<0.1%'
  return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`
}
