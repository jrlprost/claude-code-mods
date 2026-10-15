# jr-week

`/jrweek` shows your week with Claude Code: for each day and each project, how long Claude worked, how many prompts you sent, and what it cost.

```
jr week   12 Oct – 18 Oct                    [This week] [Last week] [Export]
     Claude working               time  prompts     cost
Mon  ████████████████··········   2h40       34    $4.12
Tue  ██████████················   1h38       21    $2.60
...
Total                            11h05      143   $17.90
──────────────────────────────────────────────
tokenkarma         ███████████   6h12       80   $10.40
acme               ██████·····   3h01       41    $5.02
```

- **Claude working** is the sum of the durations of Claude's turns.
- **Cost** is what the session's cost grew by during each turn, as Claude Code counts it.
- Projects are named after the folder the session runs in.

## Commands

| Command | |
| --- | --- |
| `/jrweek` | Open the week |

In the pane: `t` this week, `l` last week, `e` export the shown week as Markdown to `~/Downloads`.

The mod records from the moment it is installed; earlier weeks stay empty.

## Install

```
/plugin install jr-week --marketplace jrlprost/claude-code-mods
```

## Access

Records prompts, turns, tool names and cost in the plugin's own store. Reads the session's cost and project folder. Writes the export to `~/Downloads` when asked. Sends nothing over the network.
