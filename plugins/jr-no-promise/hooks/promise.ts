// An announcement of work about to be done, in English or French.
const ANNOUNCE = [
  /\b(I'll|I will|I'm going to|I am going to|let me|now I'll|I'm now)\s+(?!explain|clarify|summari[sz]e|recap|know|be (clear|honest|brief)|answer|walk you|show you why)\w+/i,
  /\bI'm (launching|starting|continuing|running|tackling|fixing|building|writing|deploying|working on)\b/i,
  /^\s*(next|next step|then)\s*:/im,
  /\bje (vais|lance|m'occupe|continue|m'attaque|passe à|démarre|enchaîne|corrige|construis|déploie|relance)\b/i,
  /^\s*(prochaine étape|ensuite|étape suivante)\s*:/im,
]

// A plan or a question waits for the person on purpose: never a broken promise.
const WAITS = [
  /\?\s*$/,
  /^#{1,4}\s*(plan|proposal|proposition|options?)\b/im,
  /^\s*\**(plan|proposal|proposition)\**\s*:/im,
  /\b(shall I|should I|do you want|want me to|let me know|tell me|veux-tu|tu veux|tu préfères|dis-moi|je lance \?|on y va \?)/i,
]

const lastLines = (text: string) => text.trim().split('\n').filter(l => l.trim()).slice(-6).join('\n')

/** True when the reply ends by announcing work, without being a plan or a question. */
export const isBrokenPromise = (text: string) => {
  const tail = lastLines(text)
  if (!tail || WAITS.some(w => w.test(tail))) return false
  return ANNOUNCE.some(a => a.test(tail))
}

export const REASON =
  'Your last message announces work ("I\'ll…", "Let me…", "Next:", "je vais…", "je lance…") but no tool ran in this turn. ' +
  'Do that work now with the tools, in this turn, then report what was done in the past tense. ' +
  'If you cannot do it, say so plainly and name the blocker instead of announcing it.'
