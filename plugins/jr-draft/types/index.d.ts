export type JrDraftText = string

declare module 'claude-code' {
  interface PluginState {
    'jr-draft': { text: JrDraftText; project: string }
  }
}
