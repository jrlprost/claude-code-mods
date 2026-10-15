// Shared look of every jr mod: one palette, gradients drawn one cell at a time.
// Synced into each plugin's hooks/jr/ by scripts/sync-shared.sh: edit it here only.

export type Rgb = readonly [number, number, number]

const hexToRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const rgbToHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`

export const GRADIENTS = {
  // The jr signature: violet to pink to amber.
  brand: ['#7f5af0', '#ff5ca8', '#ffb86b'],
  // Calm to alarm, for gauges where full is bad.
  heat: ['#2cb67d', '#f4d35e', '#ff8c42', '#ef4565'],
  // Cool, for neutral figures.
  ice: ['#3da9fc', '#7f5af0'],
  // Money and growth.
  money: ['#2cb67d', '#a8e6cf'],
} as const satisfies Record<string, readonly string[]>

export type GradientName = keyof typeof GRADIENTS

/** The color at `t` (0..1) along the stops. */
export const colorAt = (stops: readonly string[], t: number): string => {
  if (stops.length === 1) return stops[0]!
  const clamped = Math.min(1, Math.max(0, t))
  const span = clamped * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(span))
  const a = hexToRgb(stops[i]!)
  const b = hexToRgb(stops[i + 1]!)
  const local = span - i
  return rgbToHex([0, 1, 2].map(k => a[k]! + (b[k]! - a[k]!) * local) as unknown as Rgb)
}

/** One color per character of `text`, spread across the stops. */
export const paint = (text: string, stops: readonly string[]) => {
  const chars = [...text]
  return chars.map((char, i) => ({ char, color: colorAt(stops, chars.length > 1 ? i / (chars.length - 1) : 0) }))
}

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

/**
 * A bar `width` cells wide filled to `ratio` (0..1), with eighth-cell precision.
 * Each filled cell takes the gradient color of its position along the whole bar,
 * so a nearly full heat bar ends red and a low one stays green.
 */
export const bar = (ratio: number, width: number, stops: readonly string[]) => {
  const filled = Math.min(1, Math.max(0, ratio)) * width
  const full = Math.floor(filled)
  const partial = EIGHTHS[Math.round((filled - full) * 7)] ?? ''
  const cells: { char: string; color: string; empty?: true }[] = []
  for (let i = 0; i < width; i++) {
    const color = colorAt(stops, width > 1 ? i / (width - 1) : 0)
    if (i < full) cells.push({ char: '█', color })
    else if (i === full && partial) cells.push({ char: partial, color })
    else cells.push({ char: '·', color, empty: true })
  }
  return cells
}

export const formatTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

export const formatDuration = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}
