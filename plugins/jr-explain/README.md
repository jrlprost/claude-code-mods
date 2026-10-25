# jr-explain

When Claude asks permission to run a shell command, the question says in plain English what the command does and how risky it is, so you can answer without reading shell.

```
Deletes files and folders, including everything inside them. 🔴 high risk.
Runs a project script from package.json, then uploads your commits to the remote repository. 🟡 medium risk.
```

- About thirty common patterns are explained from a built-in table: deleting files, force pushes, hard resets, installs, `curl | bash`, `sudo`, Docker, processes, services, remote copies, in-place edits, reads.
- A compound command (`a && b`) lists each step and takes the highest risk.
- The engine's own reason for asking (the rule that matched) stays at the end, in brackets.
- Commands the table does not know get no line, unless you turn on the small-model option: a one-line explanation is then asked of a small model (a few tokens per new command, cached for the session). A command can try to talk the model into calling it safe, so the model's answer is marked as a guess and never shown below medium risk; shell comments are removed before the model reads the command, and an answer that repeats words from the command is dropped.

The terminal's permission dialog does not print the reason of a question, so the explanation also shows as a toast beside the dialog, with the command it explains, for 15 seconds:

```
🔴 high risk · Deletes files and folders, including everything inside them · $ rm -rf build
```

Only commands that are put to you are explained; commands that run without asking are left alone. In auto mode, where the classifier answers most questions, the toast still shows when a question is raised.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Explain unknown commands with a small model | off | Ask a small model when the table does not know a command |
| Model | claude-haiku-5-5 | The model asked |

## Install

```
/plugin install jr-explain --marketplace jrlprost/claude-code-mods
```

## Access

Reads the command of Bash calls whose permission is being asked. With the model option on, sends unknown commands to the model through the session's own client. Writes nothing, runs nothing.
