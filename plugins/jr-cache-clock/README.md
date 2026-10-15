# jr-cache-clock

The prompt cache stays warm for a few minutes after Claude's last reply. Inside that window the next prompt reads the conversation from the cache at a fraction of the price; after it, everything is written again at full price. This band shows how long you have.

```
cache ● warm 3:41 ██████████████····  · last hit 92%
cache ○ cold · the next prompt rewrites the cache
```

- Counts down every second from the end of the last main-loop reply, green to red.
- Shows the share of the last turn's input that was read from the cache.
- A toast 30 seconds before the cache goes cold.

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

Reads turn completions and their token usage. Writes nothing, runs nothing, sends nothing over the network.
