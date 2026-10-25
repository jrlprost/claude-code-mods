import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { DEFAULT_DICTIONARY, literalPattern, parsePairs } from './dictionary'
import { normalize } from './normalize'
import { paint, GRADIENTS } from './jr/gradient'

const edits = atom({ plugin: 'jr-dictation', key: 'edits' } as const, [])
const LEARNED = 'learned'
const commands = { isRegistered: false }

/** Registers /jr-dictation once: at session start, or first thing after a mid-session install. */
async function ensureCommand($: EngineInterface) {
  if (commands.isRegistered) return
  commands.isRegistered = true
  await $.command.register({ name: 'jr-dictation', description: 'Dictation fixes: /jr-dictation add <heard> => <right>, /jr-dictation remove <heard>, /jr-dictation list' })
}

/** Words taught with /jr-dictation add, as heard → right. */
async function learned($: EngineInterface): Promise<Record<string, string>> {
  return ((await $.store.get(LEARNED)) as Record<string, string> | undefined) ?? {}
}

/** Learned words first, then the settings list, then the built-in dictionary. */
async function dictionaryOf($: EngineInterface, extra: string, useDefaults: boolean) {
  const taught = Object.entries(await learned($)).map(([heard, right]) => [literalPattern(heard), right] as const)
  const configured = parsePairs(extra).map(([heard, right]) => [literalPattern(heard), right] as const)
  return [...taught, ...configured, ...(useDefaults ? DEFAULT_DICTIONARY : [])]
}

/** `/jr-dictation add heard => right`, `/jr-dictation remove heard`, `/jr-dictation list`. */
async function runCommand($: EngineInterface, args: string) {
  const [verb = 'list', ...rest] = args.trim().split(/\s+/)
  const words = await learned($)
  if (verb === 'add') {
    const pair = parsePairs(rest.join(' '))[0]
    if (!pair) return 'jr dictation · usage: /jr-dictation add <what you said> => <what you meant>'
    await $.store.set(LEARNED, { ...words, [pair[0].toLowerCase()]: pair[1] })
    return `jr dictation · learned: "${pair[0]}" → ${pair[1]}`
  }
  if (verb === 'remove') {
    const heard = rest.join(' ').trim().toLowerCase()
    if (!(heard in words)) return `jr dictation · "${heard}" is not a learned word`
    const { [heard]: _gone, ...kept } = words
    await $.store.set(LEARNED, kept)
    return `jr dictation · forgot "${heard}"`
  }
  const lines = Object.entries(words).map(([heard, right]) => `  "${heard}" → ${right}`)
  return lines.length
    ? `jr dictation · learned words:\n${lines.join('\n')}\n(plus ${DEFAULT_DICTIONARY.length} built-in corrections)`
    : `jr dictation · no learned words yet; ${DEFAULT_DICTIONARY.length} built-in corrections are on. Teach one with /jr-dictation add <heard> => <right>`
}

export const register: Register = (on, options) => {
  const extra = String(options.words ?? '')
  const useDefaults = options.builtIn !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await ensureCommand($)
    return started
  })

  // Installed mid-session: no session.start, so register on the first draw above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (!commands.isRegistered) {
      $.clock.after(0, () => {
        void ensureCommand($)
      })
    }
    return next(e)
  })

  on('command.run', { command: 'jr-dictation' }, async ($, e) => ({ text: await runCommand($, e.args) }))

  on('prompt.submit', async ($, e, next) => {
    await ensureCommand($)
    if (e.command || e.isMeta) return next(e)
    const edit = normalize(e.text, await dictionaryOf($, extra, useDefaults))
    if (!edit) return next(e)
    await update($, edits, list => [...list, edit].slice(-50))
    return next({ ...e, text: edit.corrected })
  })

  // The prompt row: what was removed struck in red, what was added in green.
  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    const edit = (await read($, edits)).findLast(one => one.corrected === e.props.text)
    if (!edit) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const count = edit.segments.filter(s => s.kind === 'added').length
    return (
      <Box flexDirection="column">
        <Text>
          <Text dimColor>{'> '}</Text>
          {edit.segments.map(s =>
            s.kind === 'removed' ? (
              <Text color="#ef4565" strikethrough>{s.text}</Text>
            ) : s.kind === 'added' ? (
              <Text color="#2cb67d">{s.text}</Text>
            ) : (
              <Text>{s.text}</Text>
            ),
          )}
        </Text>
        <Text>
          <Text dimColor>{'  ✎ '}</Text>
          {paint('dictation', GRADIENTS.brand).map(({ char, color }) => (
            <Text color={color}>{char}</Text>
          ))}
          <Text dimColor>{` · ${count} correction${count > 1 ? 's' : ''} · /jr-dictation add to teach a word`}</Text>
        </Text>
      </Box>
    )
  })
}
