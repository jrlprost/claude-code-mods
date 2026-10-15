/** Keys of the claim sentences, in replies of this session, that nothing in their turn verified. */
export type JrDoneCheckFlags = string[]

declare module 'claude-code' {
  interface PluginState {
    'jr-done-check': { flagged: JrDoneCheckFlags }
  }
}
