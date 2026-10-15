export type JrDecision = { at: number; text: string; source: 'command' | 'prompt' }

declare module 'claude-code' {
  interface PluginState {
    'jr-decisions': { decisions: JrDecision[]; project: string }
  }
}
