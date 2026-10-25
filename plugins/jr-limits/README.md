# jr-limits

Your plan limits in one quiet row above the prompt, aligned to the right: the fill of the 5-hour and 7-day windows, coloured green, amber or red, and when the fullest one resets.

```
                                                              5h 2% · 7d 48% ↻45h
```

- From 80 % on any window, the row moves to the left as an alert:

```
▲ 7d limit 84% · resets in 45h
```

- A toast when a window crosses 80 % and again at 95 %, once per window.
- `/jr-limits details` opens every window in a pane, as gradient gauges with the exact reset time.
- Countdowns refresh every minute.
- Nothing is drawn when the session has no plan-limit figures (API-key sessions, or before the first reply).

## Commands

| Command | |
| --- | --- |
| `/jr-limits` | Hide the band above the prompt, or bring it back |
| `/jr-limits hide` · `show` | Hide it or show it explicitly (`off` and `on` work too) |
| `/jr-limits details` | Every window in a pane, as gauges with its exact reset time |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Show the band | on | The one-row band above the prompt |

## Install

```
/plugin install jr-limits --marketplace jrlprost/claude-code-mods
```

## Access

Reads the session's rate-limit figures, the same ones the status line uses. Writes nothing, runs nothing, sends nothing over the network.
