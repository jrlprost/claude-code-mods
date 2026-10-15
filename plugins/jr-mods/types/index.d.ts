export type JrModsItem = { id: string; name: string; source: string; description: string; enabled: boolean }

export type JrModsApply = { type: 'apply'; wanted: Record<string, boolean> }

declare module 'claude-code' {
  interface PluginState {
    'jr-mods': { items: JrModsItem[] }
  }
}
