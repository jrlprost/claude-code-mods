# jr-redact

When a tool result carries a secret (a `cat .env`, a config file, a log line), the secret is replaced with a placeholder before Claude reads it. The tool itself runs unchanged; only what the model sees is rewritten, and a toast says what was hidden.

```
STRIPE_SECRET=[REDACTED:stripe-key]
DATABASE_URL=postgres://app:[REDACTED:password]@db.internal:5432/main
```

| Kind | Format |
| --- | --- |
| private-key | PEM blocks (`-----BEGIN … PRIVATE KEY-----`), removed whole |
| anthropic-key | `sk-ant-…` |
| openai-key | `sk-…`, `sk-proj-…` |
| stripe-key | `sk_live_…`, `sk_test_…`, `rk_live_…` |
| github-token | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` |
| aws-key | `AKIA…`, `ASIA…` |
| slack-token | `xoxb-`, `xoxp-` and the other `xox` prefixes |
| google-key | `AIza…` |
| jwt | `eyJ….….…` |
| password | the password part of `postgres://`, `mysql://`, `mongodb://`, `redis://`, `amqp://` URLs; the host stays readable |
| email, ip | only with the setting on |

Every tool's result is covered: Bash, Read, Grep, web fetches, MCP tools. Errors are left as they are.

Since Claude never sees the real value, it cannot copy it into a file. An edit that tries to match the placeholder fails and Claude reads the file again; secrets are meant to stay out of its reach.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Also hide emails and IP addresses | off | Replace email addresses and IPv4 addresses too |

## Install

```
/plugin install jr-redact --marketplace jrlprost/claude-code-mods
```

## Access

Reads and rewrites tool results before the model reads them. Writes nothing, runs nothing, sends nothing over the network.
