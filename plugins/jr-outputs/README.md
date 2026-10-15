# jr-outputs

`/jroutputs` lists every file this session created or changed, newest first, so you know exactly what Claude touched.

```
jr outputs  2 created · 3 changed
 + src/billing/checkout.ts        +84 -0
 ~ src/billing/plans.ts           +12 -3   ×2
 ~ package.json                    +1 -0
 + docs/billing.md                +40 -0
 ~ src/app.tsx                     +2 -2
+ created · ~ changed · counts from git when the project is a repository
```

- A file is recorded when a Write, Edit or NotebookEdit call on it succeeds.
- `+` means the file did not exist before; `~` means it was changed. `×2` is how many times it was touched.
- Line counts come from `git diff --numstat HEAD`. A new file outside git counts its lines.

## Commands

| Command | |
| --- | --- |
| `/jroutputs` | Open the list |

## Install

```
/plugin install jr-outputs --marketplace jrlprost/claude-code-mods
```

## Access

Watches Write, Edit and NotebookEdit calls (it never blocks them). Checks whether a file exists before it is written. Runs `git diff --numstat` when you open the list. Sends nothing over the network.
