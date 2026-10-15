export type JrDictationSegment = { kind: 'same' | 'removed' | 'added'; text: string }
export type JrDictationEdit = { corrected: string; segments: JrDictationSegment[] }

declare module 'claude-code' {
  interface PluginState {
    'jr-dictation': { edits: JrDictationEdit[] }
  }
}
