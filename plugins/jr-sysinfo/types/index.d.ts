/** One reading, in kilobytes (cpu in percent, 0 to 100). */
export type JrSysinfoStats = {
  diskTotal: number
  diskFree: number
  memTotal: number
  memAvailable: number
  swapTotal: number
  swapUsed: number
  cpu: number
}

declare module 'claude-code' {
  interface PluginState {
    'jr-sysinfo': { stats: JrSysinfoStats | null; isBandHidden: boolean }
  }
}
