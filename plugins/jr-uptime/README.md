# jr-uptime

Watches your sites while you work. Nothing shows while everything is up; the moment one goes down, a red band appears above the prompt.

```
 DOWN  api.example.com
```

`/jruptime` shows every site:

```
jr uptime
● example.com             200 · 84 ms
  ▃▃▂▃▄▃▃▂▃▅▃▃▂▃▃▃█▃▃▂   last incident 3 h ago, 6 min
✕ api.example.com         down 4 min
  ▂▂▃▂▂▃✕✕                no incident seen
```

- Every site is requested every 2 minutes; a status below 400 within 10 seconds counts as up.
- The sparkline shows the latency of the last 30 checks, ✕ for a failed one.
- The last incident of each site is remembered across sessions.

## Commands

| Command | |
| --- | --- |
| `/jruptime` | Check every site now and open the list |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| URLs to watch | | Separated by commas; `https://` is added when missing |
| Show the band when all is up | off | On: a green dot per site the rest of the time |

## Install

```
/plugin install jr-uptime --marketplace jrlprost/claude-code-mods
```

## Access

Sends a GET request to each URL you list, every 2 minutes, while a session is open. Keeps the last incident per site in the plugin's own store. Writes nothing else, runs nothing.
