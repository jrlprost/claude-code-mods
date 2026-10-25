# jr-draft

While Claude works, you already know what comes next. `/jr-draft` opens a scratch pane to write it, so the thought is not lost and the prompt box stays free.

```
jr draft   acme-site · 6 words · kept until you send it
┌──────────────────────────────────────────────────────┐
│ then add tests for the parser                         │
│                                                       │
└──────────────────────────────────────────────────────┘
[ Send to prompt box (s) ]  [ Clear (c) ]
```

- One draft per project, kept across sessions until you send or clear it.
- Enter, or **Send to prompt box**, puts the draft in your prompt box and empties the scratch area. You still press Enter in the prompt box to send it to Claude.
- If the prompt box is busy, the draft stays where it is.

## Commands

| Command | |
| --- | --- |
| `/jr-draft` | Open the scratch pane |

In the pane: type freely (several lines), Enter or `s` sends to the prompt box, `c` clears, Esc closes.

## Install

```
/plugin install jr-draft --marketplace jrlprost/claude-code-mods
```

## Access

Keeps drafts in the plugin's own store and fills the prompt box when you ask. Reads no files, runs nothing, sends nothing over the network.
