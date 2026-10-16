# jr-commit-coach

Keeps commits small. After each turn it measures the uncommitted work in the repository; past a threshold, a band and a toast suggest an atomic commit and how to split it.

```
▲ 364 lines uncommitted + 1 new · split: src/ docs/ root/
```

One row on the left, only while there is something to act on.

```
jr commit coach · 364 lines uncommitted, 1 new file: commit in small steps, e.g. src (320 lines, 2 files), docs (40 lines, 1 file), root (4 lines, 1 file) and 1 more
```

- Lines are `git diff --numstat HEAD` (added + removed); new untracked files are counted separately.
- The split groups the changes by top-level folder, biggest first.
- The toast comes once, then again only when the pile has grown by half. The band stays while the pile stays over the threshold and leaves after you commit.
- Silent outside a git repository.
- `/jrcommit` hides or shows the band, in every session and across restarts; `/jrcommit on` and `/jrcommit off` set it.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Threshold (lines) | 300 | Uncommitted lines from which the coach speaks up |
| Show the band | on | The line above the prompt |

## Install

```
/plugin install jr-commit-coach --marketplace jrlprost/claude-code-mods
```

## Access

Runs `git diff --numstat HEAD` and `git ls-files --others --exclude-standard` in the session's folder after each turn. Never commits anything. Sends nothing over the network. Remembers whether the band is hidden.
