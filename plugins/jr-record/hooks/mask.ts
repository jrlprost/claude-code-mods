// What gets masked on screen while recording. The model's context is never touched.

export type Mode = 'off' | 'on' | 'strict'

const BLOCK = '█████'

const RULES: { kind: string; pattern: RegExp; strictOnly?: true }[] = [
  { kind: 'key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  {
    kind: 'key',
    pattern: /\b(?:sk-ant-[A-Za-z0-9_-]{16,}|[sr]k_(?:live|test)_[0-9A-Za-z]{12,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[0-9A-Z]{16}|xox[abposr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/g,
  },
  { kind: 'key', pattern: /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PWD))\s*=\s*\S+/g },
  { kind: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'money', pattern: /(?:[$€£¥]\s?\d[\d\s.,]*\d|[$€£¥]\s?\d|\b\d[\d\s.,]*\s?(?:€|EUR|USD|GBP|\$|k€|K€)(?![A-Za-z]))/g },
  { kind: 'phone', pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,4}\d{2,4}(?=\s|$|[,;)])/g },
  { kind: 'ip', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  { kind: 'home', pattern: /\/(?:Users|home)\/[^/\s]+/g, strictOnly: true },
  { kind: 'number', pattern: /\b\d{4,}\b/g, strictOnly: true },
]

const looksLikePhone = (m: string) => {
  const digits = m.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15 && /[\s.+()-]/.test(m.trim())
}

export const maskText = (text: string, mode: Mode) => {
  if (mode === 'off') return text
  let out = text
  for (const rule of RULES) {
    if (rule.strictOnly && mode !== 'strict') continue
    out = out.replace(rule.pattern, (match, name?: string) => {
      if (rule.kind === 'phone' && !looksLikePhone(match)) return match
      if (rule.kind === 'key' && typeof name === 'string' && match.includes('=')) return `${name}=${BLOCK}`
      if (rule.kind === 'home') return '/Users/█'
      return BLOCK
    })
  }
  return out
}

/** Masks every string inside a value, keeping its shape (tool inputs and outputs). */
export const maskValue = (value: unknown, mode: Mode): unknown => {
  if (mode === 'off') return value
  if (typeof value === 'string') return maskText(value, mode)
  if (Array.isArray(value)) return value.map(v => maskValue(v, mode))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, maskValue(v, mode)]))
  }
  return value
}

export const parseMode = (arg: string, current: Mode): Mode | null => {
  const a = arg.trim().toLowerCase()
  if (a === '') return current === 'off' ? 'on' : 'off'
  if (a === 'on' || a === 'off' || a === 'strict') return a
  return null
}
