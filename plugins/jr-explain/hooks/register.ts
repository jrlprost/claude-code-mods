import type { EngineInterface, Register } from 'claude-code'

import type { Explanation } from './explain'
import { explainCommand, parseModelAnswer, reasonFor } from './explain'

const cache = new Map<string, Explanation | null>()

/** A small model's explanation, for commands the table does not know. One line, cached per command. */
async function askModel($: EngineInterface, model: string, command: string): Promise<Explanation | null> {
  if (cache.has(command)) return cache.get(command) ?? null
  const answer = await $.model.complete({
    model,
    system: 'You explain shell commands to a non-developer. Answer with one short plain-English clause saying what the command does, then " | ", then its risk: low, medium or high. Nothing else.',
    prompt: command.slice(0, 2000),
    maxTokens: 60,
    timeoutMs: 5000,
  })
  const explanation = answer.isAnswered ? parseModelAnswer(answer.text) : null
  cache.set(command, explanation)
  return explanation
}

export const register: Register = (on, options) => {
  const useModel = options.useModel === true
  const model = String(options.model ?? 'claude-haiku-5-5')

  // When a Bash call is about to be put to you, the question carries a plain-English explanation.
  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision !== 'ask') return verdict
    const command = (e.input as { command?: string }).command ?? ''
    const explanation = explainCommand(command) ?? (useModel ? await askModel($, model, command) : null)
    if (!explanation) return verdict
    return { ...verdict, reason: reasonFor(explanation, verdict.reason) }
  })
}
