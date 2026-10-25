# jr Claude Code mods

<p align="center"><img src="assets/banner.svg" alt="jr Claude Code mods: 43 mods for the Claude Code terminal" width="760"></p>

<p align="center">
  <img src="https://img.shields.io/badge/mods-43-ff5ca8" alt="43 mods">
  <img src="https://img.shields.io/badge/Claude%20Code-mods-7f5af0" alt="Claude Code mods">
  <img src="https://img.shields.io/badge/tokens%20used-0-2cb67d" alt="No tokens used by the bands">
  <img src="https://img.shields.io/badge/license-MIT-3da9fc" alt="MIT license">
</p>

<p align="center"><b>See what Claude Code doesn't show you. Stop what it shouldn't do.</b><br>
43 free, open-source mods for the Claude Code terminal. Each one installs on its own.</p>

---

## Why this exists

I build my products alone, and I spend most of my day in Claude Code. After a few months, the same moments kept costing me time and money:

- the context filled up and compacted in the middle of a task, without warning;
- I hit my plan limit with no idea it was close;
- I came back from a coffee and the prompt cache had gone cold, so the next message cost ten times more;
- Claude said *"tested and working"* when nothing had been run;
- a package it wanted to install did not exist;
- I typed into the wrong window, because six sessions look the same.

None of this is hard to see. Claude Code just doesn't show it. So each time, I wrote a mod. These are the 43 I use every day.

## What it looks like

A real session, a few seconds after launch. Every row above the prompt is one mod:

```
                                                    ctx ▕█─────────────────▏ 7% · 69k/1.0M
                                                0h00 billable · set a rate: /jr-time rate 80
                                                                                    DEMO
▲ api, web wait for you · 4 sessions
                                  goal Ship v1 ██···· 1/3 · next: write the changelog
                                                                       5h 4% · 7d 1% ↻1h
                                 disk 137G/926G free · ram 5.3G/32G free · cpu 12% · swap off
────────────────────────────────────────────────────────────────────────────────────────────
❯
```

Quiet figures sit on the right. Something that needs you, like sessions waiting for an answer, moves to the left. Every row hides with its own command, and the choice holds across sessions.

## Get started in one minute

At the prompt of any Claude Code terminal session:

```
/plugin install jr-mods --marketplace jrlprost/claude-code-mods
/jr-mods welcome
```

`jr-mods` lists every mod you have and turns them on and off with the space bar. Then add the ones you want, the same way:

```
/plugin install jr-context --marketplace jrlprost/claude-code-mods
/plugin install jr-limits --marketplace jrlprost/claude-code-mods
/plugin install jr-cache-clock --marketplace jrlprost/claude-code-mods
```

From a shell: `claude plugin install jr-context --marketplace jrlprost/claude-code-mods`.
In the desktop app: **+** next to the prompt box, **Plugins**, **Add marketplace** with `jrlprost/claude-code-mods`, then **Add plugin**.

Requires a Claude Code build with mods (function hooks). Built and tested on 2.1.301 and later.

## What is a Claude Code mod?

A mod is a Claude Code plugin written as function hooks: a small TypeScript module that runs inside Claude Code itself. A shell hook can print text or answer yes or no. A mod can:

- draw rows above the prompt, panes beside the chat, toasts and status entries;
- add slash commands;
- read, block or rewrite a tool call before it runs, and act on its result;
- remember values across sessions.

## How these mods are built

- **No tokens.** The bands, guards and counters run locally and Claude never sees them. Four mods ask a model by design, and say so: jr-explain, jr-polish, jr-post and jr-vinci.
- **One mod, one job.** Install only what you need. Nothing depends on anything else.
- **Quiet by default.** A band stays small and grey until something needs you.
- **Nothing hidden.** Each mod's README ends with an Access section: exactly what it reads, runs or sends.
- **Tested.** Every mod passes `claude plugin validate` and ships with its own tests.

## The mods

Every command is named after its mod: `jr-limits` answers to `/jr-limits`. A bare command toggles the mod's band; `details` opens the full view when there is one; mods with options also take `hide` and `show`.

### Context, limits and cost

*Know what the next message will cost before you send it.*

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-context](plugins/jr-context) | A context bar above the prompt: what fills the window, category by category, free space and the compaction point. | `/jr-context` |
| [jr-limits](plugins/jr-limits) | The 5-hour and 7-day plan windows as gauges with reset countdowns, and a toast at 80 % and 95 %. | `/jr-limits` |
| [jr-cache-clock](plugins/jr-cache-clock) | How long the prompt cache stays warm after Claude's last reply, the last cache hit rate, and a toast 30 seconds before it goes cold. | `/jr-cache-clock` |
| [jr-next-cost](plugins/jr-next-cost) | What the next prompt costs before you send it: the context it resends, at the current model's price, from a warm or a cold cache. | `/jr-next-cost` |
| [jr-quota](plugins/jr-quota) | Balances of your other paid APIs (OpenRouter, Firecrawl, DeepSeek), checked every 10 minutes, with an alert when one runs low. | `/jr-quota` |
| [jr-read-cap](plugins/jr-read-cap) | Stops Claude from reading a file over 1,000 lines whole, and tells it to search first and read only the lines it needs. |  |

### Keep Claude honest

*Trust the work, because it was checked.*

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-done-check](plugins/jr-done-check) | Flags replies that claim something was tested or verified when nothing was run in the turn to check it. |  |
| [jr-no-promise](plugins/jr-no-promise) | When a reply ends by announcing work ("I'll…", "Let me…") and no tool ran, Claude is sent back once to actually do it. |  |
| [jr-scope](plugins/jr-scope) | Warns when a turn writes sensitive files nobody asked for (lockfiles, manifests, CI, .env, migrations, infra) or too many files at once. | `/jr-scope` |
| [jr-commit-coach](plugins/jr-commit-coach) | When uncommitted changes pass a threshold, suggests small atomic commits split by folder. | `/jr-commit-coach` |
| [jr-nudges](plugins/jr-nudges) | One toast at the end of a turn when the new code added debug statements or TODO and FIXME lines. |  |

### Safety and privacy

*Let Claude work on its own without losing sleep.*

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-pkg-guard](plugins/jr-pkg-guard) | Checks every package install against its registry: names that do not exist are refused, very new packages are held back, install scripts are flagged. |  |
| [jr-deploy-guard](plugins/jr-deploy-guard) | Production deploys and pushes to main always come back to you, even in auto mode. |  |
| [jr-explain](plugins/jr-explain) | Every shell command Claude asks permission for comes with a plain-English explanation and a risk level. |  |
| [jr-redact](plugins/jr-redact) | Replaces API keys, tokens, private keys and database passwords in tool results with placeholders before Claude reads them. |  |
| [jr-record](plugins/jr-record) | Recording mode for demos and screen shares: masks emails, money amounts, keys, phone numbers and IPs on screen. | `/jr-record` |
| [jr-image-guard](plugins/jr-image-guard) | Keeps oversized images out of the conversation: images over 7,800 px are read through a resized copy. |  |
| [jr-no-ai-trailer](plugins/jr-no-ai-trailer) | Stops commits and pull requests that carry an AI co-author line or a "Generated with" footer. |  |
| [jr-mod-audit](plugins/jr-mod-audit) | Clones any mod, validates it, reads its source and gives a green, amber or red verdict before you install it. | `/jr-mod-audit` |

### Time and business

*Your work and your product, without leaving the terminal.*

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-time](plugins/jr-time) | Billable time per project: every minute sorted into categories, an hourly rate and an amount to invoice. | `/jr-time` |
| [jr-week](plugins/jr-week) | Your week per day and per project: time Claude worked, prompts and cost, with a Markdown export. | `/jr-week` |
| [jr-heatmap](plugins/jr-heatmap) | Your last 26 weeks as a GitHub-style heatmap, with streaks and peak hours. | `/jr-heatmap` |
| [jr-wrapped](plugins/jr-wrapped) | Your month, Wrapped-style: prompts, hours, streak, top tools and projects, and a share card as SVG and PNG. | `/jr-wrapped` |
| [jr-stripemrr](plugins/jr-stripemrr) | Your Stripe MRR and today's revenue above the prompt, with the last 30 days as a sparkline. | `/jr-stripemrr` |
| [jr-visitors](plugins/jr-visitors) | Live visitors from PostHog above the prompt, and today's top pages. | `/jr-visitors` |
| [jr-uptime](plugins/jr-uptime) | Pings your sites every 2 minutes and raises a red band the moment one goes down. | `/jr-uptime` |
| [jr-outage](plugins/jr-outage) | Is it them or is it me? A band when Claude, GitHub, npm or Vercel report an incident. | `/jr-outage` |

### Voice, prompts and writing

*Say it roughly, send it clearly.*

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-dictation](plugins/jr-dictation) | Fixes what dictation mishears ("cloud code" → Claude Code) before Claude reads your prompt, and shows each fix. | `/jr-dictation` |
| [jr-polish](plugins/jr-polish) | A small fast model turns a rough prompt into a clear, structured one, in your prompt box, ready to edit. | `/jr-polish` |
| [jr-draft](plugins/jr-draft) | A scratch pane to write your next prompt while Claude works, kept per project. | `/jr-draft` |
| [jr-deslop](plugins/jr-deslop) | Flags AI-writing tells (em dashes, "delve", "not X, but Y", stock openers) in the prose files Claude writes. | `/jr-deslop` |
| [jr-vinci](plugins/jr-vinci) | An opt-in sparring partner: after each answer, the sharpest challenge to what was just decided. | `/jr-vinci` |
| [jr-post](plugins/jr-post) | A short "what I built today" post drafted from the session and copied to your clipboard. | `/jr-post` |

### Workflow

*Many sessions, one head.*

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-mods](plugins/jr-mods) | Every installed plugin and mod in one list, turned on and off with the space bar. Start here. | `/jr-mods` |
| [jr-fleet](plugins/jr-fleet) | Every Claude Code session on the machine: which ones work and which ones wait for you. | `/jr-fleet` |
| [jr-badge](plugins/jr-badge) | A coloured badge with the project, branch and folder, so you always know which window you are typing in. | `/jr-badge` |
| [jr-goal](plugins/jr-goal) | A goal per project with steps to tick off and a progress gauge. | `/jr-goal` |
| [jr-decisions](plugins/jr-decisions) | A decision journal per project, exported to `docs/decisions.md`. A prompt starting with "decision:" records one. | `/jr-decisions` |
| [jr-todo](plugins/jr-todo) | Capture a task instantly, with no model call, to TODO.md, Todoist, Linear, Notion, GitHub, Things, Apple Reminders or your own command. | `/jr-todo` |
| [jr-outputs](plugins/jr-outputs) | Every file this session created or changed, newest first, with line counts from git. | `/jr-outputs` |
| [jr-sysinfo](plugins/jr-sysinfo) | Free disk and RAM, CPU load and swap, read every 5 minutes on macOS, Linux and Windows. | `/jr-sysinfo` |
| [jr-done-ping](plugins/jr-done-ping) | A notification, and a sound on macOS, when a long turn finishes. |  |
| [jr-awake](plugins/jr-awake) | Keeps the Mac awake while Claude works, and warns before the next sleep. | `/jr-awake` |

## FAQ

**Do the mods slow Claude Code down or cost tokens?** No. They run locally, outside the conversation. Only jr-explain, jr-polish, jr-post and jr-vinci ask a model, by design.

**Do they work on Linux and Windows?** Most of them work wherever Claude Code runs. jr-awake and the sound of jr-done-ping are macOS only.

**Is it safe to install a mod?** A mod runs code on your machine, like any plugin. Read its Access section, or run `/jr-mod-audit owner/repo` on any mod before installing it.

**How do I hide a band without uninstalling its mod?** Run its command: the bare command toggles the band. `/jr-mods` turns a whole mod off.

**Can I build my own?** Yes. Ask Claude Code to make a mod: every mod here started that way. Settings appear in `/config` under each mod.

## Develop

Each mod lives in `plugins/<name>`. The shared look (gradients, gauges, number formats) lives in `shared/jr` and is copied into every mod, because a mod can only import its own files:

```sh
scripts/sync-shared.sh            # after editing shared/jr
claude plugin validate plugins/jr-context
claude plugin test plugins/jr-context
```

The same banner in your terminal, in colour: `scripts/banner.sh`.

## License

MIT, by [jrlprost](https://github.com/jrlprost). Issues and ideas for new mods are welcome.
