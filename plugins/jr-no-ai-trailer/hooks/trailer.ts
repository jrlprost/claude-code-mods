// What counts as an AI attribution in a commit or a pull request.

const AI_NAMES = /(claude|anthropic|openai|chatgpt|gpt-?\d|copilot|gemini|codex|cursor|devin|\bai\b|noreply@anthropic\.com)/i

/** A `Co-Authored-By:` line naming an AI or an AI vendor's address. */
export const findAiTrailer = (text: string) => {
  for (const line of text.split(/\\n|\n/)) {
    const m = line.match(/co-authored-by:\s*(.+)/i)
    if (m && AI_NAMES.test(m[1] ?? '')) return m[0].trim().replace(/["']+$/, '')
  }
  return null
}

/** The "Generated with Claude Code" footer some tools add to commits and pull requests. */
export const findGeneratedFooter = (text: string) => {
  const m = text.match(/(🤖\s*)?generated with \[?(claude code|claude|codex|copilot)[^\n"']*/i)
  return m ? m[0].trim() : null
}

export const isCommit = (command: string) => /\bgit\b[^\n;&|]*\bcommit\b/.test(command)
export const isPullRequest = (command: string) => /\bgh\s+pr\s+(create|edit)\b/.test(command)

export type Verdict = { deny: string } | null

export const judge = (command: string, options: { allowTrailer: boolean; blockFooter: boolean }): Verdict => {
  const commit = isCommit(command)
  const pr = isPullRequest(command)
  if (!commit && !pr) return null
  if (!options.allowTrailer) {
    const trailer = findAiTrailer(command)
    if (trailer) {
      return { deny: `jr-no-ai-trailer: this ${commit ? 'commit' : 'pull request'} carries an AI co-author line ("${trailer}"). Remove that line and run it again.` }
    }
  }
  if (options.blockFooter) {
    const footer = findGeneratedFooter(command)
    if (footer) {
      return { deny: `jr-no-ai-trailer: this ${commit ? 'commit' : 'pull request'} carries an AI footer ("${footer}"). Remove it and run it again.` }
    }
  }
  return null
}
