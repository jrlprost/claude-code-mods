// What the welcome pane says about each jr mod: where it shows, the command, one line.
export type WelcomeGroup = 'shown' | 'hidden' | 'alert'

export type WelcomeEntry = { name: string; group: WelcomeGroup; command: string; what: string }

export const CATALOGUE: readonly WelcomeEntry[] = [
  { name: 'jr-context', group: 'shown', command: '/jr-context', what: 'context fill · /jr-context details for every category' },
  { name: 'jr-fleet', group: 'shown', command: '/jr-fleet', what: 'your sessions, and the ones waiting for you' },
  { name: 'jr-limits', group: 'shown', command: '/jr-limits', what: '5-hour and 7-day plan limits' },
  { name: 'jr-time', group: 'shown', command: '/jr-time', what: 'billable time today' },
  { name: 'jr-sysinfo', group: 'shown', command: '/jr-sysinfo', what: 'free disk and RAM, CPU and swap' },
  { name: 'jr-badge', group: 'hidden', command: '/jr-badge', what: 'project, branch and folder' },
  { name: 'jr-cache-clock', group: 'hidden', command: '/jr-cache-clock', what: 'prompt cache countdown' },
  { name: 'jr-next-cost', group: 'hidden', command: '/jr-next-cost', what: 'what the next prompt costs' },
  { name: 'jr-awake', group: 'hidden', command: '/jr-awake show', what: 'keep-awake status (it warns before sleep anyway)' },
  { name: 'jr-commit-coach', group: 'alert', command: '/jr-commit-coach', what: 'too many uncommitted lines' },
  { name: 'jr-scope', group: 'alert', command: '/jr-scope', what: 'sensitive files written unasked' },
  { name: 'jr-outage', group: 'alert', command: '/jr-outage', what: 'Claude, GitHub, npm or Vercel degraded' },
  { name: 'jr-uptime', group: 'alert', command: '/jr-uptime', what: 'one of your sites is down' },
  { name: 'jr-quota', group: 'alert', command: '/jr-quota', what: 'an API balance runs low' },
  { name: 'jr-record', group: 'alert', command: '/jr-record', what: 'recording mode is on' },
  { name: 'jr-goal', group: 'alert', command: '/jr-goal', what: 'once you set a goal' },
  { name: 'jr-stripemrr', group: 'alert', command: '/jr-stripemrr', what: 'once your Stripe key is set' },
  { name: 'jr-visitors', group: 'alert', command: '/jr-visitors', what: 'once PostHog is set' },
]

export const GROUP_TITLES: Record<WelcomeGroup, string> = {
  shown: 'Shown by default, one quiet row each',
  hidden: 'Hidden by default, one command to show',
  alert: 'Only when there is something to say',
}

export const BILLING = ['your billing: /jr-time shows the breakdown by category', '/jr-time rate 80 · /jr-time client <name> · /jr-time export']

export const RULE = 'A bare command toggles its band; commands with options take hide/show. /jr-mods turns whole mods on or off.'

/** Names of the enabled plugins in `claude plugin list --json`. */
export const enabledNames = (listed: readonly { id: string; enabled: boolean }[]) => listed.filter(r => r.enabled).map(r => r.id.split('@')[0] ?? r.id)

/** The catalogue entries for the installed mods, grouped in display order; empty groups left out. */
export const welcomeOf = (installed: readonly string[]) =>
  (['shown', 'hidden', 'alert'] as const)
    .map(group => ({ group, entries: CATALOGUE.filter(e => e.group === group && installed.includes(e.name)) }))
    .filter(g => g.entries.length > 0)
