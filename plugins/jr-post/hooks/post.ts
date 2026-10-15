/** The fork's question: a short "what I built today" post from this session. */
export const postPrompt = (language: string, platform: string) => `Write a short social post, in ${language}, for ${platform}, about what was built in this conversation today.

Rules:
- First person, as the developer who did the work. Concrete: name what was built and one detail that made it interesting or hard.
- 60 to 140 words. Short paragraphs. No headings.
- Plain and specific. No hype words, no em dashes, no "delve", no "not X, but Y", no "here's the thing", no rhetorical questions as openers.
- At most two hashtags at the very end, or none. No emoji, or one at most.
- Do not mention Claude, AI or assistants unless the conversation was about them.
- Reply with the post only.`

/** The post as the fork returned it, trimmed of fences or wrapping quotes. */
export const cleanPost = (text: string) =>
  text
    .trim()
    .replace(/^```[a-z]*\n?|\n?```$/g, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)
