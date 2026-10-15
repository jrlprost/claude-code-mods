import type { JrContextFill } from '../types'

export const WIDTHS = { compact: 12, normal: 24, wide: 40 } as const

/** The engine's context figures, or null while it has none yet. */
export const fillOf = (context: { tokens?: number; window: number; percent?: number }): JrContextFill | null => {
  if (context.tokens === undefined || context.window <= 0) return null
  const percent = context.percent ?? Math.round((context.tokens / context.window) * 100)
  return { tokens: context.tokens, window: context.window, percent }
}

/** Bar width for the chosen size, shrunk so the line still fits the band. */
export const barWidth = (size: string, bodyColumns: number) => {
  const wanted = WIDTHS[size as keyof typeof WIDTHS] ?? WIDTHS.normal
  // "ctx " + bar + " 100% · 999k / 999k · compact soon"
  return Math.max(6, Math.min(wanted, bodyColumns - 40))
}
