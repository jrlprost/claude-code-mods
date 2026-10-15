# jr-nudges

At the end of a turn, one toast when the code Claude just wrote left something behind:

```
jr nudges · this turn added 2 debug statements (console.log, print, debugger…) and 1 TODO/FIXME/HACK
```

- **Debug statements**: `console.log` / `debug` / `trace` / `dir`, `print(`, `debugger`, `dbg!(`, `var_dump(`, `fmt.Println(`.
- **Markers**: `TODO`, `FIXME`, `HACK`, `XXX`.
- Only what the turn **added** counts: each code file is compared with its text before the turn first touched it, so lines that were already there never trigger it.
- Code files only (TypeScript, JavaScript, Python, Ruby, Go, Rust, Java, Kotlin, Swift, PHP, C/C++, C#, Scala, Dart, Lua, Vue, Svelte). Quiet when there is nothing to report.

## Install

```
/plugin install jr-nudges --marketplace jrlprost/claude-code-mods
```

## Access

Watches Write and Edit calls on code files and reads those files before and after the turn. Never blocks a call. Runs nothing, sends nothing over the network.
