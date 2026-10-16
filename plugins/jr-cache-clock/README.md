# jr-cache-clock

The prompt cache stays warm for a few minutes after Claude's last reply. Inside that window the next prompt reads the conversation from the cache at a fraction of the price; after it, everything is written again at full price. This mod tells you how long you have.

```
                                                          cache 3:41 · hit 92%
                                                          cache cold · hit 92%
```

The countdown row is hidden by default: type `/jrcache` to show it. The toast before the cache goes cold comes either way.

- Counts down every second from the end of the last main-loop reply, green to red.
- Shows the share of the last turn's input that was read from the cache.
- A toast 30 seconds before the cache goes cold.
- `/jrcache` shows or hides the row, in every session and across restarts; `/jrcache on` and `/jrcache off` set it.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Cache lifetime (minutes) | 5 | 5 for the default cache, 60 for the one-hour cache |
| Warn before it goes cold | on | The 30-second toast |

## Install

```
/plugin install jr-cache-clock --marketplace jrlprost/claude-code-mods
```

## Access

Reads turn completions and their token usage. Remembers whether the band is hidden. Writes nothing else, runs nothing, sends nothing over the network.
