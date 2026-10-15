import type { JrModsItem } from '../types'

type Listed = { id: string; enabled: boolean; installPath?: string }

/** `claude plugin list --json` rows, sorted: enabled first, then by name. */
export const itemsOf = (listed: readonly Listed[], descriptions: Record<string, string>): JrModsItem[] =>
  listed
    .map(row => {
      const [name = row.id, source = ''] = row.id.split('@')
      return { id: row.id, name, source, description: descriptions[row.id] ?? '', enabled: row.enabled }
    })
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))

/** The plugins whose wanted state differs from the current one. */
export const changesOf = (items: readonly JrModsItem[], wanted: Record<string, boolean>) =>
  items.filter(item => wanted[item.id] !== undefined && wanted[item.id] !== item.enabled).map(item => ({ id: item.id, enable: wanted[item.id]! }))

export const summary = (done: { id: string; enable: boolean; ok: boolean }[]) => {
  const on = done.filter(d => d.ok && d.enable).length
  const off = done.filter(d => d.ok && !d.enable).length
  const failed = done.filter(d => !d.ok).map(d => d.id.split('@')[0])
  const parts = [on && `${on} enabled`, off && `${off} disabled`, failed.length && `failed: ${failed.join(', ')}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'nothing changed'
}
