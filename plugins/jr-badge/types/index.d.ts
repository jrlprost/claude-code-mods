export type JrBadge = { label: string; branch: string | null; color: string }

declare module 'claude-code' {
  interface PluginState {
    'jr-badge': { badge: JrBadge | null; isHidden: boolean }
  }
}
