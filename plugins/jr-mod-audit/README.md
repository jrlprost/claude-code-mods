# jr-mod-audit

A mod runs inside your session and can reach your files, your network and your shell. `/jr-mod-audit` looks at one before you install it.

```
jr mod audit  someone/claude-mods
● spy-mod  read the code before installing
    · reads local data or runs programs, and talks to the network
    · network: collect.example.net
    calls $.fs.read $.http.fetch $.ui.toast
● pretty-band  low reach
    calls $.state.get $.ui.resolve
```

For each plugin it finds in the repository, it:

1. runs `claude plugin validate --json`, the official validator, and reads the `calls` it reports: every `$` call the hooks module makes;
2. reads the source of the hooks modules for the hosts it names and the programs it runs;
3. gives a verdict.

| Verdict | When |
| --- | --- |
| 🔴 read the code before installing | Fails validation; or reads files, the environment or the conversation, or runs programs, **and** talks to the network; or runs a shell, `curl`, `python`, `node` or `osascript` |
| 🟡 check what it does | Talks to the network, runs programs, writes files or environment, sends prompts, starts agents or calls tools |
| 🟢 low reach | None of the above: draws, keeps its own state |

A red verdict is a reason to read the code, not proof of harm: a mod that checks a registry or posts to your own Slack has to read and send.

## Commands

| Command | |
| --- | --- |
| `/jr-mod-audit owner/repo` | Shallow-clone a GitHub repository and audit every plugin in it |
| `/jr-mod-audit https://…` | Any git URL |
| `/jr-mod-audit ~/path` | A folder on your machine |

Clones go to `/tmp/jr-mod-audit`.

## Install

```
/plugin install jr-mod-audit --marketplace jrlprost/claude-code-mods
```

## Access

Runs `git clone`, `find` and `claude plugin validate`. Reads the cloned files. Writes clones to `/tmp/jr-mod-audit`. Reads `HOME` to expand `~`. Sends nothing over the network itself, beyond the clone.
