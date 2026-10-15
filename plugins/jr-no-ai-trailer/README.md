# jr-no-ai-trailer

Keeps AI attribution out of your git history. A `git commit` whose message carries a `Co-Authored-By:` line naming an AI (Claude, an Anthropic address, GPT, Copilot, Gemini and so on) is stopped before it runs, and Claude is told to remove the line. A `gh pr create` or `gh pr edit` with a "Generated with Claude Code" footer is stopped the same way.

Human co-authors pass untouched.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Allow AI co-author lines | off | Let `Co-Authored-By` lines that name an AI through |
| Block 'Generated with' footers | on | Also stop commits and pull requests whose message says it was generated with an AI tool |

## Install

```
/plugin install jr-no-ai-trailer --marketplace jrlprost/claude-code-mods
```

## Access

Reads the command of each Bash call. Writes nothing, runs nothing, sends nothing over the network.
