// A claim that something was checked, in English or French.
// Letter-aware edges: \b does not see accented letters such as the é of "testé".
const CLAIM =
  /(?<![\p{L}])(tested|verified|validated|confirmed working|all tests pass(ed|ing)?|tests (are )?(green|passing)|(it|this|that) works( now)?|works now|testé(e|s)?|vérifié(e|s)?|validé(e|s)?|les tests passent|tests? au vert|ça marche|ça fonctionne|fonctionne (maintenant|bien|correctement))(?![\p{L}])/iu

// Said of what was NOT done: "not tested", "couldn't verify", "pas testé", "non vérifié"…
const NEGATED =
  /\b(not|never|couldn'?t|could not|can'?t|cannot|unable to|without|untested|no way to|pas|jamais|non|sans|impossible de|pu)\s+(\w+\s+){0,2}$/i

/** The sentences of `text` that claim a verification, negated ones left out. */
export const claims = (text: string) =>
  text
    .split(/(?<=[.!?\n])\s+/)
    .map(s => s.trim())
    .filter(s => {
      const m = CLAIM.exec(s)
      return m !== null && !NEGATED.test(s.slice(0, m.index))
    })

/** A tool call that can check something: a shell command, a test runner, a browser or screenshot tool. */
export const isVerifying = (tool: string) => tool === 'Bash' || /test|playwright|browser|screenshot|snapshot|lighthouse|a11y/i.test(tool)

/** A short, stable key for a sentence, to find it again in the message as drawn. */
export const keyOf = (sentence: string) => sentence.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)

export const plain = (text: string) => text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ')
