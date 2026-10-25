# jr-vinci

A sparring partner that pushes back. When it is on, after each of Claude's answers it asks one question of the conversation: what is the weakest assumption, the biggest risk, or the question whose answer would change the outcome? The answer shows as one line above the prompt.

```
⚔ vinci  Who pays when the free tier is abused by scripted sign-ups?
```

- Off by default. `/jr-vinci on` starts it, `/jr-vinci off` stops it; the choice is kept across sessions.
- One sentence, no praise, in the language of the conversation. When nothing deserves a challenge, nothing is shown.
- `/jr-vinci` opens the history of this session's challenges.
- It runs after the answer, never inside it: your turn is not slowed down.

## Commands

| Command | |
| --- | --- |
| `/jr-vinci on` | Start challenging after each answer |
| `/jr-vinci off` | Stop |
| `/jr-vinci` | Open the history |

## Cost

One extra model call per answer, on the session's own model, over the conversation as it stands. The conversation prefix is normally served from the prompt cache, so the call costs mostly its cached read plus a short reply; on a long session with a cold cache it can cost as much as a regular turn. Leave it off when you do not need it.

## Install

```
/plugin install jr-vinci --marketplace jrlprost/claude-code-mods
```

## Access

Asks the model one question over the session's own conversation (no tools). Keeps the on/off choice in the plugin's own store. Reads no files, runs nothing.
