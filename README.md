# jr mods

<p align="center"><img src="assets/banner.svg" alt="jr mods for Claude Code" width="760"></p>

The same banner in your terminal, in colour: `scripts/banner.sh`.

Claude Code mods I build because I need them. Each one is a small plugin of function hooks: it draws in the terminal, reacts to what Claude does, and installs on its own.

## Install

Add the marketplace once, then install the mods you want. At the prompt of a terminal session:

```
/plugin install jr-context --marketplace jrlprost/claude-code-mods
/plugin install jr-mods --marketplace jrlprost/claude-code-mods
/plugin install jr-time --marketplace jrlprost/claude-code-mods
```

Every mod installs the same way: replace the name. Start with `jr-mods`, then use `/jrmods` to turn the others on and off.

From a shell:

```sh
claude plugin install jr-context --marketplace jrlprost/claude-code-mods
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `jrlprost/claude-code-mods`, then **Add plugin**.

Requires a Claude Code build with mods (function hooks). Built and tested on 2.1.301.

## The mods

43 mods, each installable on its own. Every band above the prompt is one row: quiet figures on the right, alerts on the left only when something needs you. Context, fleet, limits, time and sysinfo show by default; badge, cache, next-prompt cost and awake are hidden until you ask for them. `/jrmods welcome` lists what you have and how to show or hide it.

Each band hides without turning its mod off:

- A command that takes no options toggles its band: type `/jrlimits` to hide it, again to bring it back. `/jrlimits details` opens the full view.
- A command that takes options keeps them and adds `hide` and `show`: `/jrtime hide`.
- The choice holds in every session and survives a restart. `/jrmods` turns a whole mod off.

### Context, limits and cost

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-context](plugins/jr-context) | A context bar above the prompt: what fills the window, category by category, in a stacked colour bar with a legend, free space and the compaction point. | `/jrcontext` |
| [jr-limits](plugins/jr-limits) | Plan limits above the prompt: the 5-hour and 7-day windows as gradient gauges with reset countdowns, a toast at 80 % and 95 %, and /jrlimits for the detail. | `/jrlimits` |
| [jr-cache-clock](plugins/jr-cache-clock) | A prompt-cache countdown above the prompt: how long the cache stays warm after Claude's last reply, going green to red, the last cache hit rate, and a toast 30 seconds before it goes cold. | `/jrcache` |
| [jr-next-cost](plugins/jr-next-cost) | What the next prompt costs before you send it: the context it resends, at the current model's price, read from a warm cache or written to a cold one, at API rates. | `/jrnextcost` |
| [jr-quota](plugins/jr-quota) | Balances of the other paid APIs you use (OpenRouter, Firecrawl, DeepSeek), checked every 10 minutes: /jrquota shows them all, a band and a toast appear only when one runs low. | `/jrquota` |
| [jr-read-cap](plugins/jr-read-cap) | Stops Claude from reading a long file whole: a Read of a file over 1,000 lines without a range is refused with a hint to grep first and read only the lines it needs. |  |

### Time and business

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-time](plugins/jr-time) | Billable time per project: every minute of a session sorted into categories, a ratio per category, an hourly rate, and an amount. | `/jrtime` |
| [jr-week](plugins/jr-week) | /jrweek: your week with Claude Code, per day and per project: time Claude worked, prompts and cost, with gradient bars and a Markdown export. | `/jrweek` |
| [jr-heatmap](plugins/jr-heatmap) | /jrheatmap: your last 26 weeks with Claude Code as a GitHub-style heatmap, with current and longest streak and your peak hours. | `/jrheatmap` |
| [jr-wrapped](plugins/jr-wrapped) | /jrwrapped: your month with Claude Code, Wrapped-style: prompts, hours, streak, busiest hour, top tools and projects, a persona, and a share card saved as SVG and PNG. | `/jrwrapped` |
| [jr-stripemrr](plugins/jr-stripemrr) | Your Stripe MRR and today's revenue above the prompt, refreshed every 15 minutes; /jrmrr adds the last 30 days as a sparkline. | `/jrmrr` |
| [jr-visitors](plugins/jr-visitors) | Live visitors from PostHog above the prompt (last 5 minutes and today), refreshed every 2 minutes; /jrvisitors adds today's top pages. | `/jrvisitors` |
| [jr-uptime](plugins/jr-uptime) | Pings your sites every 2 minutes; a red band above the prompt the moment one goes down, and /jruptime with latency sparklines and the last incident. | `/jruptime` |
| [jr-outage](plugins/jr-outage) | Is it them or is it me? | `/jroutage` |

### Keep Claude honest

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-done-check](plugins/jr-done-check) | Flags replies that claim something was tested or verified when nothing was run in the turn to check it: a warning under the message and a toast. |  |
| [jr-no-promise](plugins/jr-no-promise) | When a reply ends by announcing work ("I'll…", "Let me…", "je vais…") and no tool ran in the turn, Claude is sent back once to actually do it. |  |
| [jr-scope](plugins/jr-scope) | Warns when a turn writes sensitive files nobody asked for (lockfiles, manifests, CI, .env, migrations, infra) or too many files at once. | `/jrscope` |
| [jr-commit-coach](plugins/jr-commit-coach) | Nudges you toward small atomic commits: when uncommitted changes pass a threshold, a band and a toast suggest a split by folder. | `/jrcommit` |
| [jr-nudges](plugins/jr-nudges) | At the end of a turn, one toast when the code Claude wrote added debug statements (console.log, print, debugger) or TODO/FIXME/HACK lines. |  |

### Safety and privacy

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-pkg-guard](plugins/jr-pkg-guard) | Checks every package install against its registry first: names that do not exist (hallucinated or typosquatted) are refused, very new packages are held back or flagged, install scripts are flagged. |  |
| [jr-mod-audit](plugins/jr-mod-audit) | /jrmodaudit owner/repo: clones a mod, runs the official validator on each plugin in it, reads its source, and shows what it can reach with a green, amber or red verdict before you install it. | `/jrmodaudit` |
| [jr-deploy-guard](plugins/jr-deploy-guard) | Production deploys and pushes to main always come to you for confirmation, even when your rules allow them. |  |
| [jr-explain](plugins/jr-explain) | Every shell command Claude asks permission for comes with a plain-English explanation and a risk level: low, medium or high. |  |
| [jr-redact](plugins/jr-redact) | Replaces API keys, tokens, private keys and database passwords in tool results with placeholders before Claude reads them. |  |
| [jr-record](plugins/jr-record) | Recording mode for demos and screen shares: /jrrec masks emails, money amounts, keys, phone numbers and IPs on screen. | `/jrrec` |
| [jr-image-guard](plugins/jr-image-guard) | Keeps oversized images out of the conversation: an image over 7800 px is read through a resized copy, and browser viewports over the limit are refused. |  |
| [jr-no-ai-trailer](plugins/jr-no-ai-trailer) | Stops commits and pull requests that carry an AI co-author line or a 'Generated with' footer, so your history stays yours. |  |

### Voice, prompts and writing

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-dictation](plugins/jr-dictation) | Fixes what dictation mishears ("cloud code" → Claude Code) before Claude reads your prompt, and shows each fix in your prompt row: red struck, green added. | `/jrdict` |
| [jr-polish](plugins/jr-polish) | /jrpolish <rough prompt>: a small fast model rewrites it into a clear, structured prompt in the same language and puts it in your prompt box to edit and send. | `/jrpolish` |
| [jr-draft](plugins/jr-draft) | /jrdraft: a scratch pane to write your next prompt while Claude works, kept per project, sent to the prompt box when you are ready. | `/jrdraft` |
| [jr-deslop](plugins/jr-deslop) | Flags AI-writing tells (em dashes, "delve", "not X, but Y", stock openers...) in the prose files Claude writes. | `/jrdeslop` |
| [jr-vinci](plugins/jr-vinci) | An opt-in sparring partner: after each answer, one line above the prompt with the sharpest challenge to what was just decided. | `/jrvinci` |
| [jr-post](plugins/jr-post) | /jrpost: a short "what I built today" post drafted from this session, shown in a pane and copied to your clipboard. | `/jrpost` |

### Workflow

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-mods](plugins/jr-mods) | /jrmods: every installed plugin and mod in one list. | `/jrmods` `/jrmods welcome` |
| [jr-goal](plugins/jr-goal) | A goal per project with steps you tick off, shown above the prompt with a progress gauge. | `/jrgoal` |
| [jr-decisions](plugins/jr-decisions) | A decision journal per project: /jrdecide or a prompt starting with "decision:" records one, /jrdecisions lists them and exports docs/decisions.md. | `/jrdecide` `/jrdecisions` |
| [jr-todo](plugins/jr-todo) | /jrtodo <task>: capture a task instantly, with no model call, to TODO.md, Todoist, Linear, Notion, a GitHub issue, Things, Apple Reminders, or your own command. | `/jrtodo` |
| [jr-outputs](plugins/jr-outputs) | /jroutputs: every file this session created or changed, newest first, with + and - line counts from git. | `/jroutputs` |
| [jr-fleet](plugins/jr-fleet) | Every Claude Code session on this machine at a glance: which ones are working and which ones wait for you, in a band above the prompt and in /jrfleet. | `/jrfleet` |
| [jr-badge](plugins/jr-badge) | A coloured badge above the prompt naming the project, its branch and folder, so you always know which window you are typing in. | `/jrbadge` |
| [jr-done-ping](plugins/jr-done-ping) | A notification, and a sound on macOS, when a long turn finishes: work in another window and come back when Claude is done. |  |
| [jr-awake](plugins/jr-awake) | Keeps the Mac awake while Claude works, shared by every session on the machine, and warns before the next sleep. | `/jrawake` |
| [jr-sysinfo](plugins/jr-sysinfo) | Disk, RAM, CPU and swap above the prompt: free disk and RAM out of the total, CPU load, swap used, read every 5 minutes by a local script on macOS, Linux and Windows. No tokens. | `/jrsys` |

## Settings

Options appear in `/config` under each mod. Each mod's README lists its commands, settings and exactly what it reads, runs or sends.

## Develop

Each mod lives in `plugins/<name>`. The shared look (gradients, gauges, number formats) lives in `shared/jr` and is copied into every mod, because a mod can only import its own files:

```sh
scripts/sync-shared.sh            # after editing shared/jr
claude plugin validate plugins/jr-context
claude plugin test plugins/jr-context
```

## License

MIT
