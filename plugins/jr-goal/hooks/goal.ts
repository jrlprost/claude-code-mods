import type { JrGoal } from '../types'

export const USAGE =
  'jr goal · usage: /jr-goal <goal>, /jr-goal step <text>, /jr-goal done <n>, /jr-goal undo <n>, /jr-goal clear, /jr-goal (show)'

/** Applies one /jr-goal command to the current goal: the new goal (null when cleared) and what to say. */
export const applyCommand = (current: JrGoal | null, args: string, now: number): { goal: JrGoal | null; text: string } => {
  const trimmed = args.trim()
  const [verb = '', ...rest] = trimmed.split(/\s+/)
  const arg = rest.join(' ')
  if (!trimmed) return { goal: current, text: current ? describe(current) : 'jr goal · no goal yet: /jr-goal <goal>' }
  if (verb === 'clear') return { goal: null, text: 'jr goal · cleared' }
  if (verb === 'step') {
    if (!current) return { goal: current, text: 'jr goal · set a goal first: /jr-goal <goal>' }
    if (!arg) return { goal: current, text: USAGE }
    const goal = { ...current, steps: [...current.steps, { text: arg, isDone: false }], updatedAt: now }
    return { goal, text: `jr goal · step ${goal.steps.length} added` }
  }
  if (verb === 'done' || verb === 'undo') {
    const n = Number.parseInt(arg, 10)
    if (!current || !Number.isInteger(n) || n < 1 || n > current.steps.length) return { goal: current, text: USAGE }
    const steps = current.steps.map((s, i) => (i === n - 1 ? { ...s, isDone: verb === 'done' } : s))
    const goal = { ...current, steps, updatedAt: now }
    return { goal, text: `jr goal · ${progress(goal)}` }
  }
  return { goal: { goal: trimmed, steps: [], updatedAt: now }, text: `jr goal · set: ${trimmed}` }
}

export const progress = (g: JrGoal) => `${g.steps.filter(s => s.isDone).length}/${g.steps.length}`

export const describe = (g: JrGoal) =>
  [`jr goal · ${g.goal} · ${progress(g)}`, ...g.steps.map((s, i) => `  ${i + 1}. ${s.isDone ? '✓' : '○'} ${s.text}`)].join('\n')
