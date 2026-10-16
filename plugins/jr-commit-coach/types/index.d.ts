/** The uncommitted work above the threshold, as the band shows it. */
export type JrCommitCoachNudge = { lines: number; untracked: number; advice: string; folders: string[] }

declare module 'claude-code' {
  interface PluginState {
    'jr-commit-coach': { nudge: JrCommitCoachNudge | null; isBandHidden: boolean }
  }
}
