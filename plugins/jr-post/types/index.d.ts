export type JrPostDraft = { text: string; language: string; status: 'idle' | 'writing' | 'ready' | 'failed'; reason?: string }

declare module 'claude-code' {
  interface PluginState {
    'jr-post': { draft: JrPostDraft }
  }
}
