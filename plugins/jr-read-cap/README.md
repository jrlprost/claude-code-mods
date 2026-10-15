# jr-read-cap

Reading a 5,000-line file whole puts all of it in the context window, and you pay for it again on every following turn. jr-read-cap refuses whole-file reads of long files and tells Claude to search first, then read only the range it needs.

```
jr-read-cap: src/app.ts has 2,500 lines, over the 1,000-line cap for whole-file reads.
Search it first (Grep for the symbol or text you need), then Read only that range with offset and limit.
```

- Applies to Read calls with no offset, limit or pages.
- Images, PDFs and notebooks are never capped.
- A read Claude marks as deliberately large (`allow_large`) goes through, unless you turn that off.
- A file the mod cannot measure goes straight to Read, which reports the problem itself.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Line cap | 1000 | Minimum 50 |
| Let explicit large reads through | on | |

## Install

```
/plugin install jr-read-cap --marketplace jrlprost/claude-code-mods
```

## Access

Reads the size and text of files Claude is about to read, to count lines. Writes nothing, runs nothing, sends nothing over the network.
