# jr mods

```text
     ██╗██████╗    ███╗   ███╗ ██████╗ ██████╗ ███████╗
     ██║██╔══██╗   ████╗ ████║██╔═══██╗██╔══██╗██╔════╝
     ██║██████╔╝   ██╔████╔██║██║   ██║██║  ██║███████╗
██   ██║██╔══██╗   ██║╚██╔╝██║██║   ██║██║  ██║╚════██║
╚█████╔╝██║  ██║   ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████║
 ╚════╝ ╚═╝  ╚═╝   ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝
                     for Claude Code
```

In colour, in your terminal: `scripts/banner.sh`.

Claude Code mods I build because I need them. Each one is a small plugin of function hooks: it draws in the terminal, reacts to what Claude does, and installs on its own.

## Install

Add the marketplace once, then install the mods you want. At the prompt of a terminal session:

```
/plugin install jr-context --marketplace jrlprost/claude-code-mods
/plugin install jr-mods --marketplace jrlprost/claude-code-mods
/plugin install jr-time --marketplace jrlprost/claude-code-mods
```

From a shell:

```sh
claude plugin install jr-context --marketplace jrlprost/claude-code-mods
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `jrlprost/claude-code-mods`, then **Add plugin**.

Requires a Claude Code build with mods (function hooks). Built and tested on 2.1.301.

## The mods

| Mod | What it does | Command |
| --- | --- | --- |
| [jr-context](plugins/jr-context) | A context bar above the prompt. Each kind of content (system prompt, tools, MCP, memory, skills, messages) gets its own colour in one stacked bar, with a legend, the free space, the compaction buffer and the point where compaction starts. | |
| [jr-time](plugins/jr-time) | Billable time per project. Every minute of a session is sorted into categories (prompt window, Claude working with you there or away, you between prompts, elsewhere, break); you set a ratio per category and an hourly rate, and get hours and an amount per project. Export to CSV or Markdown. | `/jrtime` |
| [jr-mods](plugins/jr-mods) | Every installed plugin and mod in one list, split into a mods tab and a plugins tab. Space ticks, Enter applies every change in one go. | `/jrmods` |

More are on the way: plan limits, the cost of the next prompt, a dictation corrector, a recording mode that masks sensitive figures on screen, and others.

## Settings

Options appear in `/config` under each mod. `jr-context` has a warning threshold and a compact layout.

## Develop

Each mod lives in `plugins/<name>`. The shared look (gradients, gauges, number formats) lives in `shared/jr` and is copied into every mod, because a mod can only import its own files:

```sh
scripts/sync-shared.sh            # after editing shared/jr
claude plugin validate plugins/jr-context
claude plugin test plugins/jr-context
```

## License

MIT
