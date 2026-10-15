// Secret formats, most specific first: each match becomes [REDACTED:<kind>].

type Rule = { kind: string; pattern: RegExp; group?: number }

export const SECRET_RULES: Rule[] = [
  { kind: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: 'stripe-key', pattern: /\b[sr]k_(?:live|test)_[0-9A-Za-z]{16,}/g },
  { kind: 'openai-key', pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g },
  { kind: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/g },
  { kind: 'aws-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'slack-token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { kind: 'google-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  // Only the password of a connection string: the host and database stay readable.
  { kind: 'password', pattern: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^:\s/@]+:([^@\s]+)@/g, group: 1 },
]

export const PERSONAL_RULES: Rule[] = [
  { kind: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'ip', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
]

/** Redacts one string; counts what it replaced. */
export const redactText = (text: string, rules: Rule[], counts: Record<string, number>) => {
  let out = text
  for (const rule of rules) {
    out = out.replace(rule.pattern, (match, ...groups) => {
      counts[rule.kind] = (counts[rule.kind] ?? 0) + 1
      if (rule.group) {
        const secret = groups[rule.group - 1] as string
        return match.replace(secret, `[REDACTED:${rule.kind}]`)
      }
      return `[REDACTED:${rule.kind}]`
    })
  }
  return out
}

/** Walks any value and redacts every string in it, keeping its shape. */
export const redactValue = (value: unknown, rules: Rule[], counts: Record<string, number>): unknown => {
  if (typeof value === 'string') return redactText(value, rules, counts)
  if (Array.isArray(value)) return value.map(v => redactValue(v, rules, counts))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactValue(v, rules, counts)]))
  }
  return value
}

export const summarize = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([kind, n]) => `${n} ${kind}${n > 1 ? 's' : ''}`)
    .join(', ')
