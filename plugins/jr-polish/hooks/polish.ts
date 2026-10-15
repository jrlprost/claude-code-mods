export const SYSTEM = `You rewrite a rough, often dictated, request to a coding assistant into a clear prompt.

Rules:
- Keep the language of the request (French stays French, English stays English).
- Keep every fact, file name, constraint and intent; add none, invent none.
- Fix transcription noise, filler words and run-on sentences.
- Structure: one line for the goal, then short bullet points for details or constraints when there is more than one. No headings, no preamble.
- Reply with the rewritten prompt only.`

/** The rewritten prompt, trimmed of quotes or fences a model sometimes wraps it in. */
export const cleanReply = (text: string) =>
  text
    .trim()
    .replace(/^```[a-z]*\n?|\n?```$/g, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()

/** The command's output row: before, then after. */
export const beforeAfter = (rough: string, polished: string) =>
  `jr polish · put in the prompt box, edit it and press Enter\n\nbefore:\n${rough}\n\nafter:\n${polished}`
