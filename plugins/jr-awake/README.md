# jr-awake

Keeps your Mac awake while Claude works, and tells you before it falls asleep. One system for every Claude Code session on the machine: the mode you pick in one session applies to all of them, and the Mac stays awake as long as at least one of them needs it.

```
▲ Mac sleeps in 0:48 · /jrawake on
                                                    awake · working · held by 2
```

The warning shows whenever the Mac is about to sleep. The mode line on the right is hidden by default: `/jrawake show` turns it on.

## Modes

| Mode | The Mac stays awake |
| --- | --- |
| `working` (default) | While Claude is working in any session, from your prompt to the end of the turn |
| `session` | As long as any Claude Code session is open |
| `off` | Never: macOS sleeps as usual |

The mode is shared: `/jrawake session` in one session switches every running session within 15 seconds.

Awake means `caffeinate -i` (system idle sleep prevented). Turn on **Keep the display on too** in `/config` to also add `-d`.

## Warning before sleep

The mod reads your sleep setting (`pmset -g`) and the time since your last keyboard or pointer event. When the Mac is about to sleep and nothing holds it awake, a toast and a warning row above the prompt say so a minute before (configurable).

## Commands

| Command | |
| --- | --- |
| `/jrawake` or `/jrawake status` | Mode, how many sessions hold the Mac awake, when it will sleep next |
| `/jrawake working` | Awake while Claude works |
| `/jrawake session` (or `on`) | Awake while any session is open |
| `/jrawake off` | Let the Mac sleep |
| `/jrawake show` / `/jrawake hide` | Show or hide the mode line (hidden by default), in every session; the Mac is still kept awake and the warning still shows |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Default mode | working | Used until `/jrawake` sets one |
| Keep the display on too | off | Adds `caffeinate -d` |
| Warn before sleep (s) | 60 | When the toast fires |
| Show the band | on | Off: no warning row and no mode line |

## Install

```
/plugin install jr-awake --marketplace jrlprost/claude-code-mods
```

macOS only: elsewhere the mod stays silent.

## Access

Runs `caffeinate`, `pmset -g` and `ioreg` (idle time). Keeps the shared mode and each session's heartbeat in the plugin's own store. Sends nothing over the network.
