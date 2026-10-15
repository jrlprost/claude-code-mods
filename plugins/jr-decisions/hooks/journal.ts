import type { JrDecision } from '../types'

/** A prompt that opens with "decision:" (or the French "décision :") records the rest as a decision. */
export const decisionInPrompt = (text: string) => {
  const match = text.match(/^\s*d[ée]cision\s*:\s*(.+)$/is)
  return match?.[1]?.trim() || null
}

export const day = (at: number) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** docs/decisions.md: one numbered entry per decision, oldest first, ADR-lite. */
export const toMarkdown = (project: string, decisions: readonly JrDecision[]) => {
  const ordered = [...decisions].sort((a, b) => a.at - b.at)
  const entries = ordered.map((d, i) => {
    const [title = d.text, ...rest] = d.text.split(/(?<=[.!?])\s+/)
    return [`## ${String(i + 1).padStart(3, '0')}. ${title.replace(/[.!?]$/, '')}`, '', `- Date: ${day(d.at)}`, '- Status: accepted', ...(rest.length ? ['', rest.join(' ')] : []), ''].join('\n')
  })
  return [`# Decisions: ${project}`, '', 'Kept by jr-decisions. Newest last.', '', ...entries].join('\n')
}
