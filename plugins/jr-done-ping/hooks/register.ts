import type { EngineInterface, Register } from 'claude-code'

import { message, shouldPing, soundFile } from './ping'

async function ping($: EngineInterface, text: string, sound: string | null) {
  await $.ui.notify(text, { title: 'jr done' })
  if (!sound) return
  try {
    await $.process.run(['afplay', sound])
  } catch {
    // No afplay off macOS: the notification alone stands.
  }
}

export const register: Register = (on, options) => {
  const minSeconds = Math.max(5, Number(options.minSeconds ?? 120) || 120)
  const sound = soundFile(String(options.sound ?? 'Glass'))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!shouldPing(e, minSeconds)) return done
    const root = await $.session.root()
    const project = root.split('/').filter(Boolean).pop() ?? root
    await ping($, message(project, e), sound)
    return done
  })
}
