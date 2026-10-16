# jr-fleet

When several Claude Code sessions run at once, jr-fleet tells you which ones are working and which ones are waiting for you, without switching windows.

A quiet row on the right above the prompt names what each session works on, this one first (● working, ○ waiting or idle):

```
                                        tokenkarma ○ · acme ● · northwind ○
```

When a session finished and waits for your next prompt, the row moves to the left and says so:

```
▲ acme waits for you · 3 sessions
```

`/jrfleet details` lists them:

```
jr fleet   3 sessions · 1 working · 1 waiting for you
● acme                   waiting for you    4 min   ~/Code/clients/acme
● tokenkarma             working            now     ~/Code/brands/tokenkarma   (this one)
● northwind            idle              52 min   ~/Code/clients/northwind
```

- **Working**: Claude is on a turn. **Waiting for you**: Claude finished and nobody has sent the next prompt. **Idle**: waiting for more than 30 minutes.
- The row is always there, even with a single session, as a reminder of what you work on. Sessions that do not fit become `+3`.
- Each session needs jr-fleet installed (it is a user-scope plugin, so every new session has it).

## How it works

Every session with jr-fleet writes a small file to `~/.claude/jr-fleet/<session id>.json` every 15 seconds: folder, project, state, since when. Each reads the others' files. A file not updated for a minute is a closed session; files older than a day are deleted, and a session removes its own file when it ends.

## Commands

| Command | |
| --- | --- |
| `/jrfleet` | Hide the band above the prompt, or bring it back |
| `/jrfleet hide` · `show` | Hide it or show it explicitly (`off` and `on` work too) |
| `/jrfleet details` | List every session on the machine |

## Install

```
/plugin install jr-fleet --marketplace jrlprost/claude-code-mods
```

## Access

Reads and writes files in `~/.claude/jr-fleet/` only, and runs `rm` on that folder's stale files. Reads the session's id and folder. Sends nothing over the network.
