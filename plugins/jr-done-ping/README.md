# jr-done-ping

Start a long task, go do something else, get called back when Claude is done.

```
jr done
shop: done in 4 min 12 s
```

- A notification through your own notification channel when a main-loop turn longer than 2 minutes finishes, with the project name and the duration.
- On macOS, a system sound with it.
- Interrupted turns and subagents stay silent; a turn that stopped on an error says so.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Only after (seconds) | 120 | Minimum 5 |
| Sound (macOS) | Glass | none, Glass, Hero, Ping, Submarine, Funk, Purr |

## Install

```
/plugin install jr-done-ping --marketplace jrlprost/claude-code-mods
```

## Access

Raises notifications. Runs `afplay` with a sound from `/System/Library/Sounds`. Sends nothing over the network.
