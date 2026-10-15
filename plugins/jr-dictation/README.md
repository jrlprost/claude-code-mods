# jr-dictation

For people who dictate their prompts (Wispr Flow, Superwhisper, macOS dictation). Before Claude reads a prompt, jr-dictation fixes what speech-to-text commonly gets wrong in developer talk, and your prompt row shows each fix:

```
> open the cloud mdCLAUDE.md in cloud codeClaude Code and check the package jsonpackage.json
  ✎ dictation · 3 corrections · /jrdict add to teach a word
```

(red struck: what was heard; green: what Claude reads)

- About 35 built-in corrections: `cloud code` → Claude Code, `type script` → TypeScript, `package json` → package.json, `dot env` → .env, `local host` → localhost, `c l i` → CLI…
- Only spelled-out mishears are matched, whole words only (accents included), so correct text is never touched.
- Your own words: teach them once with `/jrdict add`, or list them in `/config`.

## Commands

| Command | |
| --- | --- |
| `/jrdict add acme corp => ACME` | Teach a correction (kept across sessions) |
| `/jrdict remove acme corp` | Forget it |
| `/jrdict list` | Show your taught words |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Your corrections | empty | `heard => right` pairs separated by `;` |
| Built-in corrections | on | Turn the built-in list off to use only yours |

Slash commands are never rewritten.

## Install

```
/plugin install jr-dictation --marketplace jrlprost/claude-code-mods
```

## Access

Rewrites the text of the prompts you send. Keeps taught words in the plugin's own store. Reads no files, runs nothing, sends nothing over the network.
