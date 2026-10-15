# jr-pkg-guard

Every package install Claude runs is checked against its registry before it runs.

- **The name does not exist**: refused. Models sometimes invent package names, and attackers register the names they invent. The refusal tells Claude to check the exact name.
- **The package is very new** (first published less than 30 days ago): held back, with its age, so you look at the author and repository first. Set it to warn instead if you prefer.
- **It runs install scripts** (npm `preinstall`, `install`, `postinstall`): a toast names them.
- **The registry cannot be reached**: the install goes ahead, and a toast says it was not checked.

| Ecosystem | Commands read | Registry |
| --- | --- | --- |
| npm | `npm install/i/add`, `pnpm add`, `yarn add`, `bun add` | registry.npmjs.org, api.npmjs.org (downloads) |
| PyPI | `pip install`, `pip3`, `pipx install`, `python -m pip install`, `uv add`, `uv pip install`, `poetry add` | pypi.org |
| crates.io | `cargo add`, `cargo install` | crates.io |
| RubyGems | `gem install` | rubygems.org |

Flags, local paths, URLs, git sources, tarballs and `-r requirements.txt` files are skipped. A plain `npm install` (no package named) is not checked.

npm documents of popular packages weigh several megabytes, so npm is read in steps: the small `latest` manifest, then the monthly downloads, and the full document only for quiet packages (under 5,000 downloads a month), to read when they were first published.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Minimum age (days) | 30 | Packages first published more recently are held back or flagged |
| New packages | block | `block` refuses the install, `warn` lets it run with a toast |

## Install

```
/plugin install jr-pkg-guard --marketplace jrlprost/claude-code-mods
```

## Access

Reads the command of each Bash call. On an install, sends the package names to their public registries (the hosts above) to look them up. Writes nothing, runs nothing.
