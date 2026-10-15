# jr-wrapped

`/jrwrapped` sums up your month with Claude Code, Wrapped-style, and saves a card you can share.

```
JR MODS · CLAUDE WRAPPED
OCTOBER 2026
The Night Owl · Your best ideas arrive after dark.

1,204           38h              21            9d               23:00          $64.20
prompts         Claude working   active days   longest streak   busiest hour   spent

TOP TOOLS            TOP PROJECTS
1. Edit 412          1. tokenkarma 640 prompts
2. Bash 380          2. acme 301 prompts
3. Read 220          3. northwind 120 prompts

[ Save the card to Downloads ]
```

The persona comes from how the month went: the hour you work most, the tool Claude used most, how many projects you touched, how many days you showed up.

## Commands

| Command | |
| --- | --- |
| `/jrwrapped` | This month |
| `/jrwrapped last` | Last month |
| `/jrwrapped 2026-09` or `/jrwrapped sep` | A given month |
| `/jrwrapped export` | Save the card as `~/Downloads/claude-wrapped-<month>.svg`, plus `.png` when `rsvg-convert` or ImageMagick is installed |

In the pane, `e` saves the card.

The mod records from the moment it is installed; earlier months stay empty.

## Install

```
/plugin install jr-wrapped --marketplace jrlprost/claude-code-mods
```

## Access

Records prompts, turns, tool names and cost in the plugin's own store. Reads the session's cost and project folder. Writes the card to `~/Downloads` and runs `rsvg-convert` or `magick` to make the PNG, when asked. Sends nothing over the network.
