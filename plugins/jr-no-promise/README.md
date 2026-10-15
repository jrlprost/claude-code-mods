# jr-no-promise

A reply that ends with "I'll update the README", "Let me fix that", "Next: deploy" or "je lance la migration", in a turn where no tool ran, is a promise left hanging. jr-no-promise sends Claude back, once, to do the work now:

> Your last message announces work but no tool ran in this turn. Do that work now with the tools, in this turn, then report what was done in the past tense. If you cannot do it, say so plainly and name the blocker instead of announcing it.

- Caught in English and French: `I'll…`, `I will…`, `I'm going to…`, `Let me…`, `Next:`, `je vais…`, `je lance…`, `je m'occupe…`, `je continue…`, `prochaine étape :`…
- Left alone: a reply that ends with a question, a plan (a `Plan` heading or `Plan:`), a request for approval ("shall I…", "tu veux…"), an explanation ("let me explain…"), and any turn where a tool ran.
- Once per turn: when Claude stops again after being sent back, it is let through.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Send Claude back | on | Turn the re-prompt off without uninstalling |

## Install

```
/plugin install jr-no-promise --marketplace jrlprost/claude-code-mods
```

## Access

Counts tool calls in each turn and reads Claude's last message when it stops. Never blocks a tool. Runs nothing, sends nothing over the network.
