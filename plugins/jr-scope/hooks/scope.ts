/** What makes a file sensitive: changing it reaches beyond the code at hand. */
export const SENSITIVE: { kind: string; test: RegExp }[] = [
  { kind: 'lockfile', test: /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum|uv\.lock)$/ },
  { kind: 'manifest', test: /(^|\/)(package\.json|Cargo\.toml|pyproject\.toml|requirements[^/]*\.txt|Gemfile|go\.mod|composer\.json)$/ },
  { kind: 'CI', test: /(^|\/)(\.github\/workflows\/[^/]+|\.gitlab-ci\.yml|\.circleci\/[^/]+|Jenkinsfile|azure-pipelines\.yml)$/ },
  { kind: 'env', test: /(^|\/)\.env(\.[^/]*)?$/ },
  { kind: 'migration', test: /(^|\/)(migrations?|migrate)\// },
  { kind: 'infra', test: /(\.tf$|\.tfvars$|(^|\/)(terraform|infra|k8s|helm)\/|(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$)/ },
]

export const sensitiveKind = (file: string) => SENSITIVE.find(s => s.test.test(file))?.kind ?? null

const baseName = (file: string) => file.split('/').pop() ?? file

/** A file counts as asked for when the prompt names it (its name, or its path from the project root). */
export const isNamedIn = (prompt: string, file: string, root: string) => {
  const rel = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file
  const p = prompt.toLowerCase()
  return p.includes(baseName(file).toLowerCase()) || p.includes(rel.toLowerCase())
}

export type ScopeVerdict = { sensitive: { file: string; kind: string }[]; total: number; isTooMany: boolean }

/** The turn's touched files judged against the prompt: sensitive files nobody asked for, and the count. */
export const judge = (prompt: string, files: readonly string[], root: string, maxFiles: number): ScopeVerdict => {
  const sensitive = files
    .map(file => ({ file, kind: sensitiveKind(file) }))
    .filter((f): f is { file: string; kind: string } => f.kind !== null && !isNamedIn(prompt, f.file, root))
  return { sensitive, total: files.length, isTooMany: files.length > maxFiles }
}

export const summary = (v: ScopeVerdict, root: string) => {
  const rel = (f: string) => (f.startsWith(`${root}/`) ? f.slice(root.length + 1) : f)
  const parts: string[] = []
  if (v.sensitive.length) parts.push(`touched ${v.sensitive.map(s => `${rel(s.file)} (${s.kind})`).join(', ')} without being asked`)
  if (v.isTooMany) parts.push(`${v.total} files changed in one turn`)
  return parts.join(' · ')
}
