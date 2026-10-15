# jr-done-check

Catches "tested", "verified", "all tests pass", "it works now" (or "testé", "vérifié", "ça marche") in a reply when nothing was run in that turn to check it.

```
⏺ I updated the checkout. Tested, it works now.
  ⚠ claims a check, but nothing was run in this turn to verify it
```

- At the end of each turn, the reply's sentences are read for a claim of verification, in English or French. Negated ones ("not tested", "couldn't verify", "pas testé") are left out.
- A claim counts as backed when the turn ran something that can check it: a shell command (Bash), or a tool whose name speaks of tests, a browser, a screenshot or an audit.
- An unbacked claim gets a toast and a warning line under the block of the reply that holds it. The warning is drawn on screen only: the conversation and what Claude reads are unchanged.

## Install

```
/plugin install jr-done-check --marketplace jrlprost/claude-code-mods
```

## Access

Reads the tool names called in each turn and Claude's final reply. Draws a line under assistant messages. Never blocks anything, runs nothing, sends nothing over the network.
