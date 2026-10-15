// Which shell commands ship to production.

const RULES: { name: string; test: RegExp }[] = [
  { name: 'Vercel production deploy', test: /\bvercel\b[^;&|]*\s--prod(uction)?\b/ },
  { name: 'Netlify production deploy', test: /\bnetlify\s+deploy\b[^;&|]*\s--prod\b/ },
  { name: 'Fly.io deploy', test: /\b(fly|flyctl)\s+deploy\b/ },
  { name: 'Firebase deploy', test: /\bfirebase\s+deploy\b/ },
  { name: 'Google Cloud deploy', test: /\bgcloud\s+(app|run|functions)\s+deploy\b/ },
  { name: 'Cloudflare deploy', test: /\bwrangler\s+(deploy|publish)\b/ },
  { name: 'Railway deploy', test: /\brailway\s+up\b/ },
  { name: 'Elastic Beanstalk deploy', test: /\beb\s+deploy\b/ },
  { name: 'Serverless production deploy', test: /\b(serverless|sls|sst)\s+deploy\b[^;&|]*\s--stage[ =](prod|production)\b/ },
  { name: 'Terraform apply', test: /\bterraform\s+apply\b/ },
  { name: 'Pulumi update', test: /\bpulumi\s+up\b/ },
  { name: 'Kubernetes change on a production context', test: /\bkubectl\s+(apply|delete|rollout|scale|set|patch|replace)\b[^;&|]*(--context[ =]\S*prod|-n[ =]?\S*prod|--namespace[ =]\S*prod)/ },
  { name: 'Helm release on production', test: /\bhelm\s+(upgrade|install|rollback|uninstall)\b[^;&|]*prod/ },
  { name: 'Push to Heroku', test: /\bgit\s+push\b[^;&|]*\bheroku\b/ },
  { name: 'Push to a production branch', test: /\bgit\s+push\b[^;&|]*(\s|:|\/)(main|master|production|prod|release)(\s|$|;|&|\|)/ },
]

export const PROTECTED_BRANCHES = ['main', 'master', 'production', 'prod', 'release']

/** The production action a command takes, or null. */
export const productionAction = (command: string) => RULES.find(r => r.test.test(command))?.name ?? null

/** A bare `git push` (no branch named): the current branch decides. */
export const isBarePush = (command: string) => /\bgit\s+push\s*(?:-u\s+|--set-upstream\s+)?(?:origin\s*)?(?:$|[;&|])/.test(command.trim())

export const FRIDAY_OVERRIDE = 'JR_FRIDAY_DEPLOY=yes'

export const isFriday = (now: number) => new Date(now).getDay() === 5
