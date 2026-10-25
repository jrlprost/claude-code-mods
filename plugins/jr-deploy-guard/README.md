# jr-deploy-guard

Anything that ships to production comes to you for a yes, even when your permission rules or mode would let it run on its own. The prompt names what the command does ("Vercel production deploy", "Push to main").

| Caught | Command |
| --- | --- |
| Vercel | `vercel --prod`, `vercel deploy --prod` |
| Netlify | `netlify deploy --prod` |
| Fly.io | `fly deploy`, `flyctl deploy` |
| Firebase | `firebase deploy` |
| Google Cloud | `gcloud app/run/functions deploy` |
| Cloudflare | `wrangler deploy`, `wrangler publish` |
| Railway, Elastic Beanstalk | `railway up`, `eb deploy` |
| Serverless, SST | `deploy --stage prod` or `production` |
| Infrastructure | `terraform apply`, `pulumi up` |
| Kubernetes, Helm | `kubectl apply/delete/rollout/…` on a `prod` context or namespace, `helm upgrade/install/rollback` with `prod` |
| Git | a push to `main`, `master`, `production`, `prod` or `release`, a push to Heroku, and a bare `git push` while on one of those branches |

Previews (`vercel deploy` without `--prod`, `netlify deploy` without `--prod`) and pushes to feature branches pass.

## When nobody would be asked

In auto mode the classifier answers permission questions on its own, and in `dontAsk` mode they are refused unseen; in a headless run (`claude -p`) there is nobody to ask. There the command is refused instead, and Claude is told to hand it to you: run it yourself at the prompt with `! <command>`. The mode is read from each prompt and each finished tool, so a switch with shift+tab counts from the next one.

## No deploys on Friday

Turn it on in `/config`: on Fridays (local time), production deploys are refused outright. When something really has to ship, the refusal tells Claude to ask you first and then prefix the command with `JR_FRIDAY_DEPLOY=yes`, which lets it through to the usual confirmation.

## Settings (`/config`)

| Option | Default | |
| --- | --- | --- |
| No deploys on Friday | off | Refuse production deploys on Fridays unless the command carries `JR_FRIDAY_DEPLOY=yes` |

## Install

```
/plugin install jr-deploy-guard --marketplace jrlprost/claude-code-mods
```

## Access

Reads the command of each Bash call when its permission is decided, and the permission mode from each prompt and finished tool. Runs `git branch --show-current` for a bare `git push`. Writes nothing, sends nothing over the network.
