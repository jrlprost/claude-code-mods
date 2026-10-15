/** A mod ships function hooks (a hooks module); a plugin does not. */
export type JrModsKind = 'mod' | 'plugin'

export type JrModsItem = { id: string; name: string; source: string; description: string; enabled: boolean; kind: JrModsKind }

export type JrModsApply = { type: 'apply'; wanted: Record<string, boolean> }

declare module 'claude-code' {
  interface PluginState {
    'jr-mods': { items: JrModsItem[] }
  }
}
