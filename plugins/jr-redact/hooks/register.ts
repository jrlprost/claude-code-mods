import type { Register } from 'claude-code'

import { PERSONAL_RULES, redactValue, SECRET_RULES, summarize } from './redact'

export const register: Register = (on, options) => {
  const rules = [...SECRET_RULES, ...(options.personal === true ? PERSONAL_RULES : [])]

  // After the tool ran, before the model reads its result: secrets become placeholders.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran
    const counts: Record<string, number> = {}
    const result = redactValue(ran.result, rules, counts)
    if (Object.keys(counts).length === 0) return ran
    $.ui.toast(`jr redact · hid ${summarize(counts)} from Claude in ${e.tool}`)
    return { result: result as typeof ran.result, context: ran.context }
  })
}
