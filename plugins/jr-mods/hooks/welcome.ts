// What the welcome pane says about each jr mod: where it shows, the command, one line.
export type WelcomeGroup = 'shown' | 'hidden' | 'alert'

export type WelcomeEntry = { name: string; group: WelcomeGroup; command: string; what: string }

export const CATALOGUE: readonly WelcomeEntry[] = [
  { name: 'jr-context', group: 'shown', command: '/jrcontext', what: 'context fill · /jrcontext details for every category' },
  { name: 'jr-fleet', group: 'shown', command: '/jrfleet', what: 'your sessions, and the ones waiting for you' },
  { name: 'jr-limits', group: 'shown', command: '/jrlimits', what: '5-hour and 7-day plan limits' },
  { name: 'jr-time', group: 'shown', command: '/jrtime', what: 'billable time today' },
  { name: 'jr-sysinfo', group: 'shown', command: '/jrsys', what: 'free disk and RAM, CPU and swap' },
  { name: 'jr-badge', group: 'hidden', command: '/jrbadge', what: 'project, branch and folder' },
  { name: 'jr-cache-clock', group: 'hidden', command: '/jrcache', what: 'prompt cache countdown' },
  { name: 'jr-next-cost', group: 'hidden', command: '/jrnextcost', what: 'what the next prompt costs' },
  { name: 'jr-awake', group: 'hidden', command: '/jrawake show', what: 'keep-awake status (it warns before sleep anyway)' },
  { name: 'jr-commit-coach', group: 'alert', command: '/jrcommit', what: 'too many uncommitted lines' },
  { name: 'jr-scope', group: 'alert', command: '/jrscope', what: 'sensitive files written unasked' },
  { name: 'jr-outage', group: 'alert', command: '/jroutage', what: 'Claude, GitHub, npm or Vercel degraded' },
  { name: 'jr-uptime', group: 'alert', command: '/jruptime', what: 'one of your sites is down' },
  { name: 'jr-quota', group: 'alert', command: '/jrquota', what: 'an API balance runs low' },
  { name: 'jr-record', group: 'alert', command: '/jrrec', what: 'recording mode is on' },
  { name: 'jr-goal', group: 'alert', command: '/jrgoal', what: 'once you set a goal' },
  { name: 'jr-stripemrr', group: 'alert', command: '/jrmrr', what: 'once your Stripe key is set' },
  { name: 'jr-visitors', group: 'alert', command: '/jrvisitors', what: 'once PostHog is set' },
]

export const GROUP_TITLES: Record<WelcomeGroup, string> = {
  shown: 'Shown by default, one quiet row each',
  hidden: 'Hidden by default, one command to show',
  alert: 'Only when there is something to say',
}

export const BILLING = ['your billing: /jrtime shows the breakdown by category', '/jrtime rate 80 · /jrtime client <name> · /jrtime export']

export const RULE = 'A bare command toggles its band; commands with options take hide/show. /jrmods turns whole mods on or off.'

/** Names of the enabled plugins in `claude plugin list --json`. */
export const enabledNames = (listed: readonly { id: string; enabled: boolean }[]) => listed.filter(r => r.enabled).map(r => r.id.split('@')[0] ?? r.id)

/** The catalogue entries for the installed mods, grouped in display order; empty groups left out. */
export const welcomeOf = (installed: readonly string[]) =>
  (['shown', 'hidden', 'alert'] as const)
    .map(group => ({ group, entries: CATALOGUE.filter(e => e.group === group && installed.includes(e.name)) }))
    .filter(g => g.entries.length > 0)
