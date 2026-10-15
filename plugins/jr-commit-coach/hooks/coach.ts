/** `git diff --numstat HEAD` lines into files with their changed line counts (binary files count 0). */
export const parseNumstat = (stdout: string) =>
  stdout
    .split('\n')
    .map(line => line.split('\t'))
    .filter(parts => parts.length >= 3)
    .map(([a = '0', r = '0', ...rest]) => ({ file: rest.join('\t'), lines: (Number(a) || 0) + (Number(r) || 0) }))

/** Changed lines grouped by top-level folder (or "root" for files at the top), biggest first. */
export const splitByFolder = (files: readonly { file: string; lines: number }[]) => {
  const groups = new Map<string, { lines: number; files: number }>()
  for (const f of files) {
    const top = f.file.includes('/') ? f.file.split('/')[0]! : 'root'
    const g = groups.get(top) ?? { lines: 0, files: 0 }
    groups.set(top, { lines: g.lines + f.lines, files: g.files + 1 })
  }
  return [...groups.entries()].map(([folder, g]) => ({ folder, ...g })).sort((a, b) => b.lines - a.lines)
}

export type Pending = { lines: number; files: number; untracked: number; split: { folder: string; lines: number; files: number }[] }

export const pending = (numstat: string, untracked: string): Pending => {
  const files = parseNumstat(numstat)
  const fresh = untracked.split('\n').filter(Boolean)
  return {
    lines: files.reduce((n, f) => n + f.lines, 0),
    files: files.length,
    untracked: fresh.length,
    split: splitByFolder([...files, ...fresh.map(file => ({ file, lines: 0 }))]),
  }
}

export const advice = (p: Pending) => {
  const parts = p.split.slice(0, 3).map(g => `${g.folder} (${g.lines} lines, ${g.files} file${g.files > 1 ? 's' : ''})`)
  const more = p.split.length > 3 ? ` and ${p.split.length - 3} more` : ''
  return `${p.lines} lines uncommitted${p.untracked ? `, ${p.untracked} new file${p.untracked > 1 ? 's' : ''}` : ''}: commit in small steps, e.g. ${parts.join(', ')}${more}`
}
