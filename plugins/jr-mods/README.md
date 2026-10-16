# jr-mods

`/jrmods` opens every installed plugin and mod in one list, so turning several on or off takes a few keys instead of a command each.

```
jr mods    mods 3   plugins 22                   17 on · 8 off
❯ ◉ claude-seo        Comprehensive SEO analysis…
  ◉ code-review       Automated code review…
  ○ postiz            Social media scheduling…
←→ mods/plugins   space toggle   ↑↓ move   a/n all/none   enter apply 1 change   esc close
```

| Key | |
| --- | --- |
| ← → (or h/l, tab) | Switch between the mods tab and the plugins tab |
| ↑ ↓ (or j/k) | Move |
| space | Tick or untick |
| a / n | Tick all / none in the current tab |
| enter | Apply every change from both tabs at once |
| esc | Close |

A mod is a plugin that ships function hooks (its `hooks/hooks.json` names `modules`); everything else is listed under plugins.

The terminal hands keys to the list only after a click on it, so the list opens with a "click here to use the keyboard" zone at the bottom: the first click only takes the keyboard. After that, a click on a row ticks it, a click on the tab line switches tabs, and a click on the last line applies.

## Welcome

The first session after install opens a welcome pane once; `/jrmods welcome` opens it again. For the jr mods you have installed, it lists what shows by default, what one command brings up, and what appears only when there is something to say, with each command, and how to read your billing with `/jrtime`.

Changes go through `claude plugin enable` and `claude plugin disable`. Run `/reload-plugins` to load them in the current session.

## Install

```
/plugin install jr-mods --marketplace jrlprost/claude-code-mods
```

## Access

Runs `claude plugin list`, `claude plugin enable` and `claude plugin disable`. Reads each installed plugin's `plugin.json` and `hooks/hooks.json` for its description and kind. Remembers whether the welcome was shown. Sends nothing over the network.
