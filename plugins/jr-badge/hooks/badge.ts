import type { JrBadge } from '../types'

// A stable colour per project, so each terminal window is recognisable at a glance.
const PALETTE = ['#61afef', '#98c379', '#e5c07b', '#56b6c2', '#e06c75', '#d19a66', '#4fd6be', '#ff9e64', '#c678dd', '#7f5af0']

export const colorOf = (name: string) => {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

/** A `badge: LABEL #hex` line in CLAUDE.md, colour optional. */
export const badgeLine = (claudeMd: string | null) => {
  const m = claudeMd?.match(/^\s*badge:\s*(.+?)\s*(#[0-9a-fA-F]{6})?\s*$/m)
  return m ? { label: m[1]!.trim(), color: m[2] ?? null } : null
}

export const badgeOf = (args: { cwd: string; home: string | null; root: string; branch: string | null; claudeMd: string | null }): JrBadge => {
  const { cwd, home, root, branch, claudeMd } = args
  const declared = badgeLine(claudeMd)
  const project = root.split('/').filter(Boolean).pop() ?? root
  const label = declared?.label ?? (home && cwd === home ? 'HOME' : project.toUpperCase())
  return { label, branch, color: declared?.color ?? colorOf(label) }
}
