# jr-badge

A coloured badge above the prompt with the project, its branch and folder. With several terminal windows open, you see at a glance which one you are typing in.

```
 SHOP  feature/cart · ~/code/shop
```

- The colour is derived from the name, so a project keeps the same colour in every window.
- In your home directory the badge says `HOME`.
- Your own label and colour: add a line to the project's `CLAUDE.md`:

```
badge: CLIENT ACME PROD #ef4565
```

- Refreshed after every turn, so a branch switch shows up.
- `/jrbadge` hides or shows it in every session, and the choice survives a restart. `/jrbadge on` and `/jrbadge off` set it explicitly.

## Install

```
/plugin install jr-badge --marketplace jrlprost/claude-code-mods
```

## Access

Runs `git rev-parse --show-toplevel` and `git branch --show-current`. Reads the project's `CLAUDE.md` and the `HOME` variable. Remembers whether the badge is hidden. Sends nothing over the network.
