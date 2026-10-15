import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { claims, isVerifying, keyOf, plain } from './claims'

const flagged = atom({ plugin: 'jr-done-check', key: 'flagged' } as const, [])
// Whether the main loop's current turn ran anything that can check a claim.
const turn = { hasVerified: false }

export const register: Register = on => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) turn.hasVerified = false
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (isVerifying(String(e.tool))) turn.hasVerified = true
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || turn.hasVerified) return done
    const found = claims(e.answer ?? '')
    if (found.length === 0) return done
    await update($, flagged, list => [...(list ?? []), ...found.map(keyOf)].slice(-100))
    $.ui.toast(`jr done-check · the reply says "${found[0]!.slice(0, 50)}" but nothing was run this turn to check it`)
    return done
  })

  // Under the block of the reply that holds the claim: one warning line. The stored message is unchanged.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    const keys = await read($, flagged)
    if (keys.length === 0) return drawn
    const text = plain(e.props.text)
    if (!keys.some(k => text.includes(k))) return drawn
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {drawn}
        <Text>
          <Text color="#ff8c42" bold>{'  ⚠ '}</Text>
          <Text color="#ff8c42">claims a check, but nothing was run in this turn to verify it</Text>
        </Text>
      </Box>
    )
  })
}
