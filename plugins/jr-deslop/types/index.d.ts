export type JrDeslopHit = { file: string; line: number; rule: string; label: string; excerpt: string }

declare module 'claude-code' {
  interface PluginState {
    /** The latest hits per file this session, newest file first. */
    'jr-deslop': { hits: JrDeslopHit[] }
  }
}
