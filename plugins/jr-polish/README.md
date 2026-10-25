# jr-polish

Turn a rough, dictated or rushed request into a clear prompt before you send it.

```
/jr-polish euh so fix the login thing in auth ts it breaks when the token expires and dont touch the api

jr polish · put in the prompt box, edit it and press Enter

before:
euh so fix the login thing in auth ts it breaks when the token expires and dont touch the api

after:
Fix the login bug in auth.ts that breaks when the token expires.
- Keep the API unchanged.
```

- A small fast model (Haiku by default) rewrites the request: same language, every fact kept, nothing invented, filler and transcription noise removed, details as short bullets.
- The result goes into your prompt box, not straight to Claude: you read it, edit it, and send it yourself.
- If the model gives no answer, your prompt box is left untouched.

## Commands

| Command | |
| --- | --- |
| `/jr-polish <rough prompt>` | Rewrite it and put it in the prompt box |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Model | `haiku` | Any alias (`haiku`, `sonnet`) or full model id |

## Cost

One small-model call per `/jr-polish`, roughly the length of your prompt in and out.

## Install

```
/plugin install jr-polish --marketplace jrlprost/claude-code-mods
```

## Access

Sends the text you pass to `/jr-polish` to the model through your own Claude Code session, and fills the prompt box. Reads no files, runs nothing.
