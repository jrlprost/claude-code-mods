# jr-outage

Is it them or is it me? jr-outage checks the public status pages of the services a build depends on, every 10 minutes.

```
▲ GitHub Partial outage of Actions · /jr-outage details
```

One row on the left, only while there is something to act on.

- Claude, GitHub, npm and Vercel.
- A band and a toast appear only while one of them reports an incident; an unreachable status page is not treated as an outage.

## Commands

| Command | |
| --- | --- |
| `/jr-outage` | Hide or show the band (it toggles); `/jr-outage hide` and `show` set it |
| `/jr-outage details` | Check now and show every service in a pane |

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Show the band during an incident | on | |

## Install

```
/plugin install jr-outage --marketplace jrlprost/claude-code-mods
```

## Access

Fetches the public `status.json` of status.claude.com, githubstatus.com, status.npmjs.org and vercel-status.com. No key, no personal data. Remembers whether the band is hidden; runs nothing.
