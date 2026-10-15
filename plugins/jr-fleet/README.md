# jr-fleet

When several Claude Code sessions run at once, jr-fleet tells you which ones are working and which ones are waiting for you, without switching windows.

```
fleet 3 sessions · 1 waiting for you: acme
```

`/jrfleet` lists them:

```
jr fleet   3 sessions · 1 working · 1 waiting for you
● acme                   waiting for you    4 min   ~/Code/clients/acme
● tokenkarma             working            now     ~/Code/brands/tokenkarma   (this one)
● northwind            idle              52 min   ~/Code/clients/northwind
```

- **Working**: Claude is on a turn. **Waiting for you**: Claude finished and nobody has sent the next prompt. **Idle**: waiting for more than 30 minutes.
- The band appears only when another session is open on the machine.
- Each session needs jr-fleet installed (it is a user-scope plugin, so every new session has it).

## How it works

Every session with jr-fleet writes a small file to `~/.claude/jr-fleet/<session id>.json` every 15 seconds: folder, project, state, since when. Each reads the others' files. A file not updated for a minute is a closed session; files older than a day are deleted, and a session removes its own file when it ends.

## Commands

| Command | |
| --- | --- |
| `/jrfleet` | List every session on the machine |

## Install

```
/plugin install jr-fleet --marketplace jrlprost/claude-code-mods
```

## Access

Reads and writes files in `~/.claude/jr-fleet/` only, and runs `rm` on that folder's stale files. Reads the session's id and folder. Sends nothing over the network.
