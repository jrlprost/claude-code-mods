/** The last turn's scope warning, kept until the next turn starts. */
export type JrScopeWarning = string

declare module 'claude-code' {
  interface PluginState {
    'jr-scope': { warning: JrScopeWarning | null; isBandHidden: boolean }
  }
}
