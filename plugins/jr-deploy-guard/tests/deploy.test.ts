import { test, expect, mock } from 'claude-code/testing'

import { isBarePush, isFriday, productionAction } from '../hooks/deploy'

test('production deploys are recognised', async () => {
  expect(productionAction('vercel deploy --prod')).toBe('Vercel production deploy')
  expect(productionAction('npx vercel --prod --yes')).toBe('Vercel production deploy')
  expect(productionAction('netlify deploy --dir dist --prod')).toBe('Netlify production deploy')
  expect(productionAction('fly deploy')).toBe('Fly.io deploy')
  expect(productionAction('gcloud run deploy api --region eu')).toBe('Google Cloud deploy')
  expect(productionAction('wrangler deploy')).toBe('Cloudflare deploy')
  expect(productionAction('kubectl apply -f k8s/ --context gke-prod')).toBe('Kubernetes change on a production context')
  expect(productionAction('git push origin main')).toBe('Push to a production branch')
  expect(productionAction('git push origin HEAD:production')).toBe('Push to a production branch')
})

test('previews and ordinary commands pass', async () => {
  expect(productionAction('vercel deploy')).toBe(null)
  expect(productionAction('netlify deploy --dir dist')).toBe(null)
  expect(productionAction('git push origin feature/login')).toBe(null)
  expect(productionAction('kubectl apply -f k8s/ --context kind-dev')).toBe(null)
  expect(productionAction('npm run build')).toBe(null)
})

test('a bare git push is spotted', async () => {
  expect(isBarePush('git push')).toBe(true)
  expect(isBarePush('git push -u origin')).toBe(true)
  expect(isBarePush('git push origin feature')).toBe(false)
})

test('Friday is local Friday', async () => {
  expect(isFriday(new Date(2026, 9, 16, 15, 0).getTime())).toBe(true)
  expect(isFriday(new Date(2026, 9, 15, 15, 0).getTime())).toBe(false)
})

test('a production deploy is put to the person, even when rules allowed it', async ($, on) => {
  mock.clock(on, { now: new Date(2026, 9, 15, 10, 0).getTime() })
  on('tool.check', () => ({ decision: 'allow' }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'feature\n', stderr: '' } }) as never)
  const deploy = await $.tool.check({ tool: 'Bash', input: { command: 'vercel --prod' }, approver: 'person' } as never)
  expect(deploy.decision).toBe('ask')
  expect(deploy.reason).toContain('Vercel production deploy')
  const build = await $.tool.check({ tool: 'Bash', input: { command: 'npm run build' }, approver: 'person' } as never)
  expect(build.decision).toBe('allow')
})

test('a bare push on main is put to the person', async ($, on) => {
  mock.clock(on)
  on('tool.check', () => ({ decision: 'allow' }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '' } }) as never)
  const push = await $.tool.check({ tool: 'Bash', input: { command: 'git push' }, approver: 'person' } as never)
  expect(push.decision).toBe('ask')
})

test('with no Friday deploys on, a Friday deploy is refused unless overridden', { options: { noFridayDeploys: true } }, async ($, on) => {
  mock.clock(on, { now: new Date(2026, 9, 16, 15, 0).getTime() })
  on('tool.check', () => ({ decision: 'allow' }) as never)
  const friday = await $.tool.check({ tool: 'Bash', input: { command: 'fly deploy' }, approver: 'person' } as never)
  expect(friday.decision).toBe('deny')
  expect(friday.reason).toContain('JR_FRIDAY_DEPLOY=yes')
  const forced = await $.tool.check({ tool: 'Bash', input: { command: 'JR_FRIDAY_DEPLOY=yes fly deploy' }, approver: 'person' } as never)
  expect(forced.decision).toBe('ask')
})

test('in auto mode, where nobody is asked, a production push is refused and handed to the person', async ($, on) => {
  mock.clock(on)
  on('tool.check', () => ({ decision: 'ask' }) as never)
  on('classic.UserPromptSubmit', () => ({}) as never)
  await $.classic.UserPromptSubmit({ prompt: 'push it', permission_mode: 'auto' } as never)
  const push = await $.tool.check({ tool: 'Bash', input: { command: 'git push origin main' }, approver: 'person' } as never)
  expect(push.decision).toBe('deny')
  expect(push.reason).toContain('`! git push origin main`')
  // Back in the default mode the person is asked again.
  await $.classic.UserPromptSubmit({ prompt: 'push it', permission_mode: 'default' } as never)
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push origin main' }, approver: 'person' } as never)).decision).toBe('ask')
})

test('where nobody can be asked at all, a production deploy is refused', async ($, on) => {
  mock.clock(on)
  on('tool.check', () => ({ decision: 'allow' }) as never)
  const deploy = await $.tool.check({ tool: 'Bash', input: { command: 'vercel --prod' } } as never)
  expect(deploy.decision).toBe('deny')
  expect(deploy.reason).toContain('nobody can be asked')
})
