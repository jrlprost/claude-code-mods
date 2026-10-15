import type { JrOutput } from '../types'

/** The file a Write, Edit or NotebookEdit call touches, or null for any other tool. */
export const touchedPath = (tool: string, input: Record<string, unknown>) => {
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return typeof input.file_path === 'string' ? input.file_path : null
  if (tool === 'NotebookEdit') return typeof input.notebook_path === 'string' ? input.notebook_path : null
  return null
}

/** Records one touch: a file seen again keeps its first "created" verdict and moves to the top. */
export const record = (list: readonly JrOutput[], path: string, existed: boolean, at: number): JrOutput[] => {
  const prev = list.find(o => o.path === path)
  const entry: JrOutput = prev ? { ...prev, at, edits: prev.edits + 1 } : { path, isCreated: !existed, at, edits: 1 }
  return [entry, ...list.filter(o => o.path !== path)]
}

/** `git diff --numstat` lines into a map of path (relative to the repo) → [added, removed]. */
export const parseNumstat = (stdout: string) => {
  const out = new Map<string, [number, number]>()
  for (const line of stdout.split('\n')) {
    const [a, r, ...rest] = line.split('\t')
    if (!rest.length) continue
    out.set(rest.join('\t'), [Number(a) || 0, Number(r) || 0])
  }
  return out
}

export const relative = (root: string, file: string) => (file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file)
