# jr-record

Recording mode for demos, screen shares and videos. `/jrrec` masks what you would not want on screen, everywhere the transcript draws text: your prompts, Claude's replies, command output, tool calls and their results.

```
● REC masking on · /jrrec off

Sent the invoice to █████: █████ due on the 30th.
STRIPE_SECRET_KEY=█████
```

| Masked | `on` | `strict` |
| --- | --- | --- |
| Emails | ✓ | ✓ |
| Money amounts (`€`, `$`, `£`, `EUR`, `USD`…) | ✓ | ✓ |
| API keys, tokens, private keys, `NAME_KEY=value` lines | ✓ | ✓ |
| Phone numbers | ✓ | ✓ |
| IP addresses | ✓ | ✓ |
| Home folder names in paths (`/Users/█/…`) | | ✓ |
| Any number of 4 digits or more | | ✓ |

Only the drawing changes. Claude still reads the real text, your files are untouched, and the transcript on disk keeps everything. The mode is remembered across sessions, so a recording setup stays masked until you turn it off; a red `● REC` band above the prompt shows it is on.

## Commands

| Command | |
| --- | --- |
| `/jrrec` | Toggle on and off |
| `/jrrec on` | Mask emails, money, keys, phones, IPs |
| `/jrrec strict` | Also home paths and long numbers |
| `/jrrec off` | Show everything again |
| `/jrrec hide` / `/jrrec show` | Hide or show the REC band, in every session; masking stays active |

## Install

```
/plugin install jr-record --marketplace jrlprost/claude-code-mods
```

## Access

Rewrites what the terminal draws for messages and tool rows. Keeps the mode in the plugin's own store. Writes nothing else, runs nothing, sends nothing over the network.
