// Built-in corrections for what dictation apps (Wispr Flow, Superwhisper, macOS dictation)
// commonly mishear in developer prompts. Each entry: [pattern (regex source, case-insensitive), fix].
// A pattern matches whole words only. Spelled-out forms are matched, not the right spelling,
// so a correct word is never rewritten.
export const DEFAULT_DICTIONARY: ReadonlyArray<readonly [string, string]> = [
  ['cloud ?\\.? ?md|clod ?md|claude ?dot ?md', 'CLAUDE.md'],
  ['agents ?dot ?md|agent ?md', 'AGENTS.md'],
  ['cloud code|clod code|clawed code|claude coat', 'Claude Code'],
  ['clawed|glaude', 'Claude'],
  ['anthropique|antropic|anthropik', 'Anthropic'],
  ['m c p s|mcps', 'MCPs'],
  ['m c p', 'MCP'],
  ['type script', 'TypeScript'],
  ['java script', 'JavaScript'],
  ['git hub', 'GitHub'],
  ['git lab', 'GitLab'],
  ['read me', 'README'],
  ['package dot json|package json', 'package.json'],
  ['dot env', '.env'],
  ['local host', 'localhost'],
  ['next dot js|next js', 'Next.js'],
  ['node dot js|node js', 'Node.js'],
  ['tail wind', 'Tailwind'],
  ['super base', 'Supabase'],
  ['versel|ver cell', 'Vercel'],
  ['post gres|postgre sql', 'Postgres'],
  ['o auth', 'OAuth'],
  ['reg ex', 'regex'],
  ['jason file', 'JSON file'],
  ['yamel', 'YAML'],
  ['dock er', 'Docker'],
  ['kuber netties|cooper netties', 'Kubernetes'],
  ['play right', 'Playwright'],
  ['pnpm install|p n p m', 'pnpm'],
  ['n p m', 'npm'],
  ['c l i', 'CLI'],
  ['a p i', 'API'],
  ['u r l', 'URL'],
  ['s q l', 'SQL'],
]

/** "heard => right; heard2 => right2" from the settings field. */
export const parsePairs = (text: string): [string, string][] =>
  text
    .split(/[;\n]/)
    .map(pair => pair.split('=>').map(part => part.trim()))
    .filter((parts): parts is [string, string] => parts.length === 2 && parts[0] !== '' && parts[1] !== '')

/** A literal heard phrase as a pattern: regex characters escaped, spaces optional. */
export const literalPattern = (heard: string) =>
  heard
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, ' ?')
