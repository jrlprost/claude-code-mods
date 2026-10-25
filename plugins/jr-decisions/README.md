# jr-decisions

A decision journal per project. Record a decision the moment you take it, find it again in a pane, and export the journal as `docs/decisions.md`.

```
jr decisions  shop · 3
  #3 2026-10-16  Never deploy on Fridays
  #2 2026-10-15  Use Stripe Checkout rather than Elements
  #1 2026-10-15  Keep Postgres
/jr-decisions export writes docs/decisions.md
```

Two ways to record one:

- `/jr-decisions Keep Postgres`
- a prompt that starts with `decision:` (or `décision :`): the decision is recorded, and the prompt still goes to Claude as written.

## Commands

| Command | |
| --- | --- |
| `/jr-decisions <decision>` | Record a decision |
| `/jr-decisions` | Open the journal, newest first |
| `/jr-decisions export` | Write `docs/decisions.md` in the project: one numbered entry per decision, with its date and status |

The journal is kept per project (the session's root folder).

## Install

```
/plugin install jr-decisions --marketplace jrlprost/claude-code-mods
```

## Access

Keeps decisions in the plugin's own store. Reads prompts only to spot a leading `decision:`. Writes `docs/decisions.md` in the project only when you run the export. Sends nothing over the network.
