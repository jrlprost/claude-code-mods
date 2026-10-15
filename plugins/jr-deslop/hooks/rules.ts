import type { JrDeslopHit } from '../types'

export type Rule = { id: string; label: string; pattern: RegExp }

// Tells of machine-written prose. Each is a hint for a human to judge, never an automatic rewrite.
export const RULES: Rule[] = [
  { id: 'em-dash', label: 'em dash', pattern: /—/ },
  { id: 'delve', label: '"delve"', pattern: /\bdelv(?:e|es|ed|ing)\b/i },
  { id: 'worth-noting', label: 'filler transition', pattern: /\b(?:it(?:'|’)s worth (?:noting|mentioning)|it is worth noting|needless to say|it goes without saying)\b/i },
  { id: 'not-but', label: '"not X, but Y" framing', pattern: /\bnot (?:just|only|merely|simply) [^.;:!?]{1,50},? but\b|\b(?:isn(?:'|’)t|is not) (?:just |only )?[^.;:!?]{1,40}[,;] it(?:'|’)s\b/i },
  { id: 'fast-paced', label: 'stock opener', pattern: /\bin today(?:'|’)s (?:fast-paced|digital|ever-changing|rapidly evolving|modern) (?:world|age|landscape|era)\b|\bin an (?:ever-changing|increasingly) [a-z-]+ world\b/i },
  { id: 'throat-clearing', label: 'throat-clearing', pattern: /\bhere(?:'|’)s (?:the thing|the kicker|the deal|why|what most people miss)\b|\blet(?:'|’)s (?:dive in|dive into|unpack|break (?:this|it) down|delve)\b|\bthe uncomfortable truth\b|\blet that sink in\b|\bmake no mistake\b/i },
  { id: 'grand-words', label: 'inflated word', pattern: /\b(?:tapestry|testament to|realm of|ever-evolving|navigat(?:e|ing) the (?:complexities|landscape)|game-chang(?:er|ing)|cutting-edge|unlock(?:s|ing)? the (?:power|potential)|elevate your|seamless(?:ly)?|robust and scalable|harness the power)\b/i },
  { id: 'adverb-triplet', label: 'rule of three', pattern: /\b\w+ly, \w+ly,? and \w+ly\b/i },
  { id: 'closer', label: 'stock closer', pattern: /\b(?:i hope this helps|in conclusion,|ultimately, |at the end of the day)\b/i },
  { id: 'fr-filler', label: 'tournure de remplissage', pattern: /\bil est (?:important|essentiel|crucial|intéressant) de (?:noter|souligner|rappeler)\b|\bn(?:'|’)hésitez pas\b/i },
  { id: 'fr-opener', label: 'formule toute faite', pattern: /\b(?:en constante évolution|dans un monde où|plongeons(?: ensemble)?|à l(?:'|’)ère du numérique)\b/i },
  { id: 'fr-not-but', label: '"ce n\'est pas X, c\'est Y"', pattern: /\bce n(?:'|’)est pas (?:seulement |juste |qu(?:'|’)un(?:e)? )?[^.;:!?]{1,50}, c(?:'|’)est\b/i },
]

export const PROSE = /\.(?:md|mdx|markdown|txt|rst)$/i

/** Hits per line, outside fenced code blocks and inline code. */
export const scan = (file: string, text: string): JrDeslopHit[] => {
  const hits: JrDeslopHit[] = []
  let inFence = false
  text.split('\n').forEach((raw, i) => {
    if (/^\s*(?:```|~~~)/.test(raw)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const line = raw.replace(/`[^`]*`/g, '')
    for (const rule of RULES) {
      const m = line.match(rule.pattern)
      if (m) hits.push({ file, line: i + 1, rule: rule.id, label: rule.label, excerpt: excerptAround(line, m.index ?? 0) })
    }
  })
  return hits
}

const excerptAround = (line: string, at: number) => {
  const start = Math.max(0, at - 24)
  const end = Math.min(line.length, at + 40)
  return `${start > 0 ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`
}
