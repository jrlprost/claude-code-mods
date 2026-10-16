# jr-quota

The balances of the other paid APIs you use, in one place, checked every 10 minutes. A one-row band and a toast appear only when one runs low: `▲ OpenRouter $2.10 left · /jrquota details`.

```
jr quota
● OpenRouter  ██████████████··  $74.75 left
● Firecrawl   ██··············  300 credits left
● DeepSeek                      3.20 USD left
```

| Service | Endpoint | Key |
| --- | --- | --- |
| OpenRouter | `GET /api/v1/credits` | A management key (a regular key gets "key lacks access") |
| Firecrawl | `GET /v2/team/credit-usage` | Your API key |
| DeepSeek | `GET /user/balance` | Your API key |

Services without a key are skipped.

## Commands

| Command | |
| --- | --- |
| `/jrquota` | Hide the band above the prompt, or bring it back |
| `/jrquota hide` · `show` | Hide it or show it explicitly (`off` and `on` work too) |
| `/jrquota details` | Check now and show every balance in a pane |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| OpenRouter / Firecrawl / DeepSeek key | empty | Stored as secrets. Empty reads `OPENROUTER_API_KEY`, `FIRECRAWL_API_KEY`, `DEEPSEEK_API_KEY` |
| Low balance ($) | 5 | OpenRouter and DeepSeek |
| Low Firecrawl credits | 500 | |

## Install

```
/plugin install jr-quota --marketplace jrlprost/claude-code-mods
```

## Access

Sends your keys to openrouter.ai, api.firecrawl.dev and api.deepseek.com only, to read balances. Reads the three environment variables above. Writes nothing, runs nothing.
