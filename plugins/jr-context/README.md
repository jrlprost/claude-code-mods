# jr-context

The context window in one quiet row above the Claude Code prompt, aligned to the right so it stays out of the way.

```
                                              ctx ▕█████─────────────▏ 26% · 256k/1.0M
```

- A mini bar coloured by category (system prompt, tools, memory, skills, messages...), the fill in a colour from green to red, the tokens used and the window.
- Once the window reaches the warning threshold of where compaction starts (80 % by default), the row moves to the left as an alert:

```
▲ context 85% · compacts in 117k · /jr-context details
```

- `/jr-context details` opens the full view in a pane: header, the stacked bar across the width, and the legend with each category's tokens and share.

```
◆ context                          272k of 1.0M · compacts at 967k  27%
███████████████████────────────────────────────────────────────────▓▓
■ system prompt 2.2k 0.2%   ■ system tools 21k 2.1%   ■ messages 233k 23%
─ free space 695k   █ autocompact buffer 33k
```

- The figures are the engine's own, the same breakdown as `/context`.

## Commands

| Command | |
| --- | --- |
| `/jr-context` | Hide the band above the prompt, or bring it back |
| `/jr-context hide` · `show` | Hide it or show it explicitly (`off` and `on` work too) |
| `/jr-context details` | Open the full bar, legend included, in a pane |

## Install

```
/plugin install jr-context --marketplace jrlprost/claude-code-mods
```

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Warn at (%) | 80 | Share of the compaction point from which the row becomes an alert |

## Access

Reads the session's context usage. Writes nothing, runs nothing, sends nothing over the network.
