# jr-scope

Tells you when a turn reaches further than you asked: it writes a sensitive file your prompt never named, or changes too many files at once.

```
▲ scope touched pnpm-lock.yaml (lockfile), .env (env) without being asked
```

At the end of each turn, the files Claude wrote (Write, Edit, NotebookEdit) are checked against the prompt that started the turn:

| Kind | Files |
| --- | --- |
| lockfile | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`, `Cargo.lock`, `poetry.lock`, `uv.lock`, `Gemfile.lock`, `composer.lock`, `go.sum` |
| manifest | `package.json`, `Cargo.toml`, `pyproject.toml`, `requirements*.txt`, `Gemfile`, `go.mod`, `composer.json` |
| CI | `.github/workflows/*`, `.gitlab-ci.yml`, `.circleci/*`, `Jenkinsfile`, `azure-pipelines.yml` |
| env | `.env`, `.env.*` |
| migration | anything under `migrations/`, `migration/` or `migrate/` |
| infra | `*.tf`, `*.tfvars`, `terraform/`, `infra/`, `k8s/`, `helm/`, `Dockerfile`, `docker-compose*.yml` |

A sensitive file is fine when the prompt names it (its file name or its path). The warning shows as a toast and stays above the prompt until the next turn.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| Too many files | 15 | Warn when one turn changes more files than this |
| Show the band | on | Keep the last warning above the prompt |

## Install

```
/plugin install jr-scope --marketplace jrlprost/claude-code-mods
```

## Access

Watches Write, Edit and NotebookEdit calls and reads the prompt of each turn. Never blocks a call. Runs nothing, sends nothing over the network.
