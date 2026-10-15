export type JrVinciChallenge = { at: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    'jr-vinci': { isOn: boolean; history: JrVinciChallenge[]; isThinking: boolean }
  }
}
