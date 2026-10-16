# jr-next-cost

What your next prompt will cost before you press Enter. Every request resends the whole conversation; this band prices that at the session model's rates.

```
next ≈ $0.10 to resend 512k · cache warm 3:41 · $2.56 once cold
next ≈ $2.56 to resend 512k · cache cold
```

- Warm cache: the context is read from the cache (cache-read price).
- Cold cache: it is written again (1.25 × the input price).
- Prices are Anthropic's first-party API rates for the model in use: Claude Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 and the older models still served. On a subscription you do not pay per token; read the figure as what the turn is worth at API rates.
- Your own prompt text and Claude's answer come on top; the resent context is usually most of the cost.
- `/jrnextcost` hides or shows the band, in every session and across restarts; `/jrnextcost on` and `/jrnextcost off` set it.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Cache lifetime (minutes) | 5 | 5 or 60 |
| Input price override | 0 | $ per million tokens; 0 uses the built-in table |
| Cache read price override | 0 | Used with the input override; 0 means a tenth of it |

## Install

```
/plugin install jr-next-cost --marketplace jrlprost/claude-code-mods
```

## Access

Reads the session's context size, model and turn completions. Remembers whether the band is hidden. Writes nothing else, runs nothing, sends nothing over the network.
