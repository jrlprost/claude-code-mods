# jr-limits

Your plan limits above the prompt: the 5-hour and 7-day windows as gradient gauges, green to red, with the time left until each resets.

```
limits 5h ██████████▎····· 64% 1h12   7d █████··········· 31% 3d 4h
```

- A toast when a window crosses 80 % and again at 95 %, once per window.
- Countdowns refresh every minute.
- Nothing is drawn when the session has no plan-limit figures (API-key sessions, or before the first reply).

## Commands

| Command | |
| --- | --- |
| `/jrlimits` | Every window in a pane, with its exact reset time |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Show the band | on | The gauges above the prompt |

## Install

```
/plugin install jr-limits --marketplace jrlprost/claude-code-mods
```

## Access

Reads the session's rate-limit figures, the same ones the status line uses. Writes nothing, runs nothing, sends nothing over the network.
