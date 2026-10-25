# jr-goal

One goal per project, broken into steps you tick off, always in view above the prompt.

```
                     goal Ship the billing page ███··· 2/5 · next: Wire Stripe webhooks
```

One quiet row, right-aligned, out of the way of your eye.

## Commands

| Command | |
| --- | --- |
| `/jr-goal <goal>` | Set the goal for this project (replaces the previous one) |
| `/jr-goal step <text>` | Add a step |
| `/jr-goal done <n>` | Tick step n |
| `/jr-goal undo <n>` | Untick step n |
| `/jr-goal` | Show the goal and its steps |
| `/jr-goal clear` | Remove the goal |
| `/jr-goal hide` / `/jr-goal show` | Hide or show the band, in every session; the goal is kept |

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
