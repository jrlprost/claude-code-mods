export type JrRecordMode = 'off' | 'on' | 'strict'

declare module 'claude-code' {
  interface PluginState {
    'jr-record': { mode: JrRecordMode; isLoaded: boolean }
  }
}
