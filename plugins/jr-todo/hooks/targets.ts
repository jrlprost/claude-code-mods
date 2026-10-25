// Where /jr-todo sends a task, and how. Every target is built here as plain data, so it can be tested
// without the network; register.ts carries it out.

export const TARGETS = ['markdown', 'todoist', 'linear', 'notion', 'github', 'things', 'reminders', 'custom'] as const
export type Target = (typeof TARGETS)[number]

export type TodoOptions = {
  target: Target
  file: string
  todoistToken: string
  linearKey: string
  linearTeamId: string
  notionToken: string
  notionDatabaseId: string
  notionTitleProperty: string
  command: string
}

export type Plan =
  | { kind: 'http'; url: string; init: { method: 'POST'; headers: Record<string, string>; body: string }; describe: string }
  | { kind: 'process'; argv: string[]; describe: string }
  | { kind: 'append'; file: string; line: string; describe: string }
  | { kind: 'missing'; what: string }

export const optionsOf = (raw: Readonly<Record<string, unknown>>): TodoOptions => ({
  target: TARGETS.includes(raw.target as Target) ? (raw.target as Target) : 'markdown',
  file: String(raw.file ?? ''),
  todoistToken: String(raw.todoistToken ?? ''),
  linearKey: String(raw.linearKey ?? ''),
  linearTeamId: String(raw.linearTeamId ?? ''),
  notionToken: String(raw.notionToken ?? ''),
  notionDatabaseId: String(raw.notionDatabaseId ?? ''),
  notionTitleProperty: String(raw.notionTitleProperty || 'Name'),
  command: String(raw.command ?? ''),
})

/** The plan to file `task` in the configured target. `root` is the project's root folder. */
export const planFor = (task: string, o: TodoOptions, root: string): Plan => {
  switch (o.target) {
    case 'todoist':
      if (!o.todoistToken) return { kind: 'missing', what: 'a Todoist API token' }
      return {
        kind: 'http',
        url: 'https://api.todoist.com/api/v1/tasks',
        init: { method: 'POST', headers: { Authorization: `Bearer ${o.todoistToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: task }) },
        describe: 'Todoist inbox',
      }
    case 'linear':
      if (!o.linearKey || !o.linearTeamId) return { kind: 'missing', what: 'a Linear API key and team id' }
      return {
        kind: 'http',
        url: 'https://api.linear.app/graphql',
        init: {
          method: 'POST',
          headers: { Authorization: o.linearKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier } } }',
            variables: { input: { teamId: o.linearTeamId, title: task } },
          }),
        },
        describe: 'Linear',
      }
    case 'notion':
      if (!o.notionToken || !o.notionDatabaseId) return { kind: 'missing', what: 'a Notion token and database id' }
      return {
        kind: 'http',
        url: 'https://api.notion.com/v1/pages',
        init: {
          method: 'POST',
          headers: { Authorization: `Bearer ${o.notionToken}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent: { database_id: o.notionDatabaseId },
            properties: { [o.notionTitleProperty]: { title: [{ text: { content: task } }] } },
          }),
        },
        describe: 'Notion',
      }
    case 'github':
      return { kind: 'process', argv: ['gh', 'issue', 'create', '--title', task, '--body', 'Captured with /jr-todo'], describe: 'a GitHub issue in this repository' }
    case 'things':
      return { kind: 'process', argv: ['open', `things:///add?title=${encodeURIComponent(task)}`], describe: 'Things' }
    case 'reminders':
      // The task travels as an argument, never inside the script text.
      return {
        kind: 'process',
        argv: ['osascript', '-e', 'on run argv', '-e', 'tell application "Reminders" to make new reminder with properties {name:(item 1 of argv)}', '-e', 'end run', task],
        describe: 'Apple Reminders',
      }
    case 'custom':
      if (!o.command.includes('{task}')) return { kind: 'missing', what: 'a custom command containing {task}' }
      // {task} becomes a quoted shell argument: the task text is never parsed as shell code.
      return { kind: 'process', argv: ['sh', '-c', o.command.replaceAll('{task}', '"$1"'), 'jr-todo', task], describe: 'your command' }
    default: {
      const file = o.file ? (o.file.startsWith('/') ? o.file : `${root}/${o.file}`) : `${root}/TODO.md`
      return { kind: 'append', file, line: `- [ ] ${task}`, describe: file.split('/').pop() ?? 'TODO.md' }
    }
  }
}

/** The file with the line added at the end, on a line of its own. */
export const appendLine = (current: string, line: string) => {
  if (!current) return `${line}\n`
  return `${current}${current.endsWith('\n') ? '' : '\n'}${line}\n`
}

/** Linear answers 200 with an errors array when something failed. */
export const httpFailure = (status: number, ok: boolean, text: string) => {
  if (!ok) return `HTTP ${status}`
  try {
    const body = JSON.parse(text) as { errors?: { message?: string }[]; data?: { issueCreate?: { success?: boolean } } }
    if (body.errors?.length) return body.errors[0]?.message ?? 'error'
    if (body.data?.issueCreate && !body.data.issueCreate.success) return 'not created'
  } catch {
    // Not JSON: an ok status is enough.
  }
  return null
}
