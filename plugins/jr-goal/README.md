# jr-goal

One goal per project, broken into steps you tick off, always in view above the prompt.

```
◆ goal 2/5 ████······ Ship the billing page · next: Wire Stripe webhooks
```

## Commands

| Command | |
| --- | --- |
| `/jrgoal <goal>` | Set the goal for this project (replaces the previous one) |
| `/jrgoal step <text>` | Add a step |
| `/jrgoal done <n>` | Tick step n |
| `/jrgoal undo <n>` | Untick step n |
| `/jrgoal` | Show the goal and its steps |
| `/jrgoal clear` | Remove the goal |
| `/jrgoal hide` / `/jrgoal show` | Hide or show the band, in every session; the goal is kept |

The goal is kept per project (the session's root folder) and comes back in every session opened there.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Show the band | on | The line above the prompt |

## Install

```
/plugin install jr-goal --marketplace jrlprost/claude-code-mods
```

## Access

Keeps goals in the plugin's own store. Reads nothing else, runs nothing, sends nothing over the network.
