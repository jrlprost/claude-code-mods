# jr-sysinfo

Your machine in one quiet row above the prompt: free disk, free RAM, CPU load and swap.

```
disk 116G/926G free · ram 5.5G/32G free · cpu 32% · swap 21.2G/22G used
```

- Each figure turns from green to red as it fills.
- Read when the session starts, then every 5 minutes, by a small local script: `sh` on macOS and Linux, Windows PowerShell on Windows.
- No model call: the band costs no tokens and Claude never sees it.

## Commands

| Command | |
| --- | --- |
| `/jrsys` | Hide or show the band (it toggles); `/jrsys hide` and `show` set it |
| `/jrsys now` | Read the machine again now |

## Install

```
/plugin install jr-sysinfo --marketplace jrlprost/claude-code-mods
```

## Access

Runs one read-only command every 5 minutes while a session is open: on macOS `df`, `sysctl`, `vm_stat` and `top`; on Linux `df` and `/proc/meminfo` and `/proc/stat`; on Windows PowerShell's `Get-CimInstance`. Disk is the system drive (`/`, or `C:` on Windows). Keeps only the band choice in the plugin's own store. Sends nothing.
