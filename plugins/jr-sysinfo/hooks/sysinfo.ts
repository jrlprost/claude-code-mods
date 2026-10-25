import type { JrSysinfoStats } from '../types'

// Both scripts print the same four lines, in kilobytes, so one parser reads every system:
//   disk <total> <free>
//   mem <total> <available>
//   swap <total> <used>
//   cpu <percent>

/** macOS and Linux, run by sh. Anything else (a Windows sh such as Git Bash) prints `os other`. */
export const UNIX_SCRIPT = `case "$(uname -s)" in
Darwin)
  df -kP / | awk 'NR==2 {print "disk", $2, $4}'
  ps=$(sysctl -n hw.pagesize)
  vm_stat | awk -v ps="$ps" -v total="$(sysctl -n hw.memsize)" '/^Pages (free|inactive|speculative):/ {s += $NF} END {printf "mem %d %d\\n", total / 1024, s * ps / 1024}'
  sysctl -n vm.swapusage | awk '{t = $3 + 0; u = $6 + 0; if ($3 ~ /G/) t *= 1024; if ($6 ~ /G/) u *= 1024; printf "swap %d %d\\n", t * 1024, u * 1024}'
  top -l 2 -n 0 -s 1 | awk '/^CPU usage/ {idle = $7 + 0} END {printf "cpu %.0f\\n", 100 - idle}'
  ;;
Linux)
  df -kP / | awk 'NR==2 {print "disk", $2, $4}'
  awk '/^MemTotal:/ {t = $2} /^MemAvailable:/ {a = $2} /^SwapTotal:/ {st = $2} /^SwapFree:/ {sf = $2} END {print "mem", t, a; print "swap", st, st - sf}' /proc/meminfo
  a=$(head -n 1 /proc/stat); sleep 1; b=$(head -n 1 /proc/stat)
  printf '%s\\n%s\\n' "$a" "$b" | awk '{idle = $5 + $6; tot = 0; for (j = 2; j <= NF; j++) tot += $j; if (NR == 1) {i1 = idle; t1 = tot} else if (tot > t1) printf "cpu %.0f\\n", 100 * (1 - (idle - i1) / (tot - t1)); else print "cpu 0"}'
  ;;
*)
  echo "os other"
  ;;
esac`

/** Windows, run by Windows PowerShell (present on every Windows since 7). */
export const WINDOWS_SCRIPT = `$ErrorActionPreference = 'Stop'
$os = Get-CimInstance Win32_OperatingSystem
$d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'"
$pf = Get-CimInstance Win32_PageFileUsage | Measure-Object -Property AllocatedBaseSize, CurrentUsage -Sum
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
"disk $([math]::Floor($d.Size / 1KB)) $([math]::Floor($d.FreeSpace / 1KB))"
"mem $($os.TotalVisibleMemorySize) $($os.FreePhysicalMemory)"
"swap $([int64]$pf[0].Sum * 1024) $([int64]$pf[1].Sum * 1024)"
"cpu $([math]::Round([double]$cpu))"`

/** The four lines, or null when one is missing or not a number. */
export const parseStats = (out: string): JrSysinfoStats | null => {
  const line = (key: string) => {
    const m = out.match(new RegExp(`^${key} (.+)$`, 'm'))
    return m ? m[1]!.trim().split(/\s+/).map(Number) : []
  }
  const [diskTotal, diskFree] = line('disk')
  const [memTotal, memAvailable] = line('mem')
  const [swapTotal, swapUsed] = line('swap')
  const [cpu] = line('cpu')
  const all = [diskTotal, diskFree, memTotal, memAvailable, swapTotal, swapUsed, cpu]
  if (all.some(n => n === undefined || !Number.isFinite(n))) return null
  return {
    diskTotal: diskTotal!,
    diskFree: diskFree!,
    memTotal: memTotal!,
    memAvailable: memAvailable!,
    swapTotal: swapTotal!,
    swapUsed: swapUsed!,
    cpu: Math.min(100, Math.max(0, cpu!)),
  }
}

/** Kilobytes as a short size: 494G, 16G, 6.1G, 512M. */
export const size = (kb: number) => {
  const gb = kb / 1024 / 1024
  if (gb >= 100) return `${Math.round(gb)}G`
  if (gb >= 1) return `${Number(gb.toFixed(1))}G`
  return `${Math.round(kb / 1024)}M`
}

/** How full each figure is, 0 to 1, for the colour (more full is worse). */
export const pressure = (s: JrSysinfoStats) => ({
  disk: s.diskTotal > 0 ? 1 - s.diskFree / s.diskTotal : 0,
  mem: s.memTotal > 0 ? 1 - s.memAvailable / s.memTotal : 0,
  cpu: s.cpu / 100,
  swap: s.swapTotal > 0 ? s.swapUsed / s.swapTotal : 0,
})
