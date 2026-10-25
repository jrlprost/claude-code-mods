# jr-deslop

Checks the prose Claude writes for the tells of machine-written text, and tells you where they are. It never rewrites anything: you decide.

After Claude writes or edits a `.md`, `.mdx`, `.markdown`, `.txt` or `.rst` file:

```
jr deslop · 6 AI-writing tells in launch-notes.md · /jr-deslop to see them
```

`/jr-deslop` lists them by file and line:

```
jr deslop   6 tells in 1 file · hints, not rules
docs/launch-notes.md
     2  stock opener            In today’s fast-paced world, we delve into…
     2  "delve"                 …fast-paced world, we delve into the details.
     3  filler transition       It’s worth noting that this is not just a tool…
     3  "not X, but Y" framing  …that this is not just a tool, but a platform.
```

## What it looks for

| Tell | Example |
| --- | --- |
| Em dash | `—` |
| "delve" | delve, delving |
| Filler transition | it's worth noting, needless to say |
| "not X, but Y" framing | not just a tool, but a platform · it isn't X, it's Y |
| Stock opener | in today's fast-paced world |
| Throat-clearing | here's the thing, let's dive in, let that sink in |
| Inflated word | tapestry, testament to, seamless, game-changer, unlock the power |
| Rule of three | quickly, safely, and reliably |
| Stock closer | I hope this helps, in conclusion, |
| French tells | il est important de noter, n'hésitez pas, en constante évolution, ce n'est pas X, c'est Y |

Fenced code blocks and inline code are skipped.

## Commands

| Command | |
| --- | --- |
| `/jr-deslop` | List the tells found this session |
| `/jr-deslop <file>` | Check one file now |

## Install

```
/plugin install jr-deslop --marketplace jrlprost/claude-code-mods
```

## Access

Reads the prose files Claude has just written or edited, and the file you name. Writes nothing, runs nothing, sends nothing over the network.
