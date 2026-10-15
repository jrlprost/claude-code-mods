/** One service as its status page reports it: none, minor, major, critical, maintenance, or unknown. */
export type JrOutageService = { name: string; indicator: string; description: string }

export type JrOutageView = { services: JrOutageService[]; checkedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'jr-outage': { view: JrOutageView | null }
  }
}
