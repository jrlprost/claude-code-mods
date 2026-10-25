# jr-todo

Capture a task the moment you think of it, without leaving Claude Code and without spending a model call.

```
/jr-todo renew the domain before Friday
jr todo · ✓ "renew the domain before Friday" → TODO.md
```

## Targets

Pick one in `/config` → jr-todo → **Where tasks go**.

| Target | Where the task lands | What it needs |
| --- | --- | --- |
| `markdown` (default) | `- [ ] task` appended to `TODO.md` at the project root, or the file you set | nothing |
| `todoist` | Your Todoist inbox (API v1) | API token |
| `linear` | A new issue in a Linear team | Personal API key + team id |
| `notion` | A new page in a Notion database | Integration token + database id (+ title column name, default `Name`) |
| `github` | A new issue in the current repository, via `gh` | `gh` signed in |
| `things` | Things 3 inbox (macOS) | Things installed |
| `reminders` | Apple Reminders, default list (macOS) | Allow access the first time |
| `custom` | Any command you set, with `{task}` where the task goes | the command |

Tokens and keys are stored as sensitive settings, never in plain settings files.

### Any other tool through `custom`

The task is handed to your command as one quoted argument, so its text is never run as shell code. For example:

- **Google Tasks** (it needs a Google sign-in, which a mod cannot do for you): point `custom` at a Google Tasks command-line tool or script you already have signed in, such as `my-gtasks add {task}`
- **A webhook**: `curl -s -X POST https://example.com/hook -d "task={task}"`
- **Your own script**: `/Users/you/bin/add-task {task}`

## Commands

| Command | |
| --- | --- |
| `/jr-todo <task>` | File the task in the configured target |

When a target refuses the task (bad token, missing team), nothing is saved and the reason is shown.

## Install

```
/plugin install jr-todo --marketplace jrlprost/claude-code-mods
```

## Access

Depending on the target you choose: appends to one markdown file; or sends the task text to Todoist, Linear or Notion with your token; or runs `gh issue create`, `open things:///…`, `osascript` (Reminders) or your own command. Nothing happens until you type `/jr-todo`.
