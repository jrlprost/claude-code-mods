export type JrOutput = {
  path: string
  /** The file did not exist before the session touched it. */
  isCreated: boolean
  at: number
  edits: number
  added?: number
  removed?: number
}

declare module 'claude-code' {
  interface PluginState {
    'jr-outputs': { outputs: JrOutput[]; root: string }
  }
}
