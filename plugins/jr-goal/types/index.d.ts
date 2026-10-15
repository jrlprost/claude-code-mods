export type JrGoalStep = { text: string; isDone: boolean }

export type JrGoal = { goal: string; steps: JrGoalStep[]; updatedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'jr-goal': { goal: JrGoal | null }
  }
}
