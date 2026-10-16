# jr-context

A context bar above the Claude Code prompt.

```
◆ context                          272k of 1.0M · compacts at 967k  27%
███████████████████────────────────────────────────────────────────▓▓
■ system prompt 2.2k 0.2%   ■ system tools 21k 2.1%   ■ messages 233k 23%
─ free space 695k   █ autocompact buffer 33k
```

- One stacked bar across the full width: each kind of content in the window has its own colour, the free space is a thin line, the compaction buffer a dark block at the end.
- The header shows tokens used, the window, where compaction starts, and the fill in a pill that goes from green to red.
- From the warning threshold on (80 % by default), the header says compaction is near.
- The figures are the engine's own, the same breakdown as `/context`.

## Commands

| Command | |
| --- | --- |
| `/jrcontext` | Hide the band above the prompt, or bring it back |
| `/jrcontext hide` · `show` | Hide it or show it explicitly (`off` and `on` work too) |
| `/jrcontext details` | Open the full bar, legend included, in a pane |

## Install

```
/plugin install jr-context --marketplace jrlprost/claude-code-mods
```

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Warn at (%) | 80 | Fill from which the header warns |
| Layout | full | `full`: header, bar and legend. `compact`: header and bar only |

When Claude Code gives the band fewer than four rows, the legend is left out.

## Access

Reads the session's context usage. Writes nothing, runs nothing, sends nothing over the network.
