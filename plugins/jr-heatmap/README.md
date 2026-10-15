# jr-heatmap

`/jrheatmap` draws your last 26 weeks with Claude Code as a GitHub-style grid: one square per day, coloured by how many prompts you sent, from dark violet to amber.

```
jr heatmap   last 26 weeks · 1,204 prompts on 97 days
    May     Jun       Jul     Aug       Sep     Oct
Mon ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
    ...
Sun ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
    less ■ ■ ■ ■ ■ more

✦ 6 days current streak   21 days longest
hours ▁▁▁▁▁▁▂▅██▆▅▃▅▇█▆▄▃▂▂▃▂▁  peak 09:00
```

- Each level is a quarter of your busiest day.
- The current streak counts back from today, or from yesterday when you have not sent a prompt yet today.
- The hours row adds up prompts per hour of the day over the 26 weeks.

## Commands

| Command | |
| --- | --- |
| `/jrheatmap` | Open the heatmap |

The mod records from the moment it is installed; earlier days stay empty.

## Install

```
/plugin install jr-heatmap --marketplace jrlprost/claude-code-mods
```

## Access

Records prompts, turns, tool names and cost in the plugin's own store. Reads the session's cost and project folder. Sends nothing over the network.
