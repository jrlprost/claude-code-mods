# jr-visitors

Who is on your site right now, from PostHog, above the prompt.

```
visitors ● 3 now · 118 today
```

`/jrvisitors details` adds today's top pages:

```
jr visitors   updated 14:05
● 3            118
last 5 min     today
TOP PAGES TODAY
████████████    40 /pricing
████········    12 /
```

- **Now** counts unique people with a page view in the last 5 minutes; **today** since midnight in your PostHog project's time zone.
- The band refreshes every 2 minutes; `/jrvisitors details` refreshes everything when you open it.

## Setup

In PostHog, create a **personal API key** (Settings → Personal API keys) with the **Query Read** scope. In `/config` under jr-visitors, set the host (`us`, `eu`, or your own), the project id (the number in `/project/12345`), and the key. The key is stored as a secret.

## Commands

| Command | |
| --- | --- |
| `/jrvisitors` | Hide or show the band (it toggles); `/jrvisitors hide` and `show` set it |
| `/jrvisitors details` | Visitors now, today, and today's top pages |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| PostHog host | us | `us`, `eu`, or a self-hosted URL |
| Project id | | Your project's number |
| Personal API key | | Query Read scope |
| Show the band | on | Visitors above the prompt |

## Install

```
/plugin install jr-visitors --marketplace jrlprost/claude-code-mods
```

## Access

Sends three read-only HogQL queries to your PostHog host with your personal API key. Keeps the figures in memory for the session. Writes nothing, runs nothing.
