export type JrModAuditRisk = 'green' | 'amber' | 'red'

export type JrModAuditPlugin = {
  name: string
  dir: string
  isValid: boolean
  errors: string[]
  calls: string[]
  hosts: string[]
  commands: string[]
  risk: JrModAuditRisk
  why: string[]
}

export type JrModAuditReport = {
  target: string
  status: 'running' | 'done' | 'error'
  error?: string
  plugins: JrModAuditPlugin[]
}

declare module 'claude-code' {
  interface PluginState {
    'jr-mod-audit': { report: JrModAuditReport | null }
  }
}
