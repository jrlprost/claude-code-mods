export const VINCI_PROMPT = `Act as a demanding sparring partner, not an assistant. Look at what was just decided or built in this conversation.
Give the single sharpest challenge: the weakest assumption, the biggest risk, or the one question whose answer would change the outcome.
One sentence, at most 30 words, in the language of the conversation. No praise, no preamble, no list. If nothing deserves a challenge, reply exactly: nothing to challenge.`

/** One line, no quotes or markdown; null when the model found nothing to challenge. */
export const challengeOf = (text: string) => {
  const line = text
    .trim()
    .split('\n')[0]!
    .replace(/^[-*>#\s"“]+|["”]+$/g, '')
    .replace(/\*\*/g, '')
    .trim()
  if (!line || /^nothing to challenge\.?$/i.test(line)) return null
  return line.length > 220 ? `${line.slice(0, 217)}…` : line
}
