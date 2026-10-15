export type JrBadge = { label: string; detail: string; color: string }

declare module 'claude-code' {
  interface PluginState {
    'jr-badge': { badge: JrBadge | null }
  }
}
