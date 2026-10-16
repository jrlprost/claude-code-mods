# jr-time

Billable time for work done with Claude Code. Every minute of a session is recorded raw and sorted into categories; you decide afterwards how much of each category you bill, at what hourly rate, per project.

```
jr time    today  week  month                     presence: keyboard & pointer
                                                time     ratio    billable
❯ ● Prompt window              ██████········   1h12  ◂   100% ▸  1h12
  ● Claude working, you there  ██████████████   2h03      100%    2h03
  ● Claude working, you away   ████··········   0h40       50%    0h20
  ● You, between prompts       ██████········   0h55      100%    0h55
  ● At the computer, elsewhere ██············   0h18        0%    0h00
  ● Break                      ███···········   0h35        0%    0h00
    Prompt window length                               5 min
    Idle after                                         5 min
  ──────────────────────────────────────────────────────────────────────
  tokenkarma (Acme)                             3h32    90€/h    318 €
  Total                                         4h30             405 €
```

## The categories

Each 15-second slot of a session gets exactly one category, so no minute is counted twice.

| Category | When | Default ratio |
| --- | --- | --- |
| Prompt window | The first minutes after each prompt (5 by default), always counted. A new prompt restarts the window; it never doubles it. | 100 % |
| Claude working, you there | Claude is working and you are active on the computer | 100 % |
| Claude working, you away | Claude is working and you have not touched the keyboard or pointer | 50 % |
| You, between prompts | No turn running, you are active, and Claude's last prompt or reply is less than the idle time ago | 100 % |
| At the computer, elsewhere | You are active, but Claude's last activity is older than the idle time | 0 % |
| Break | Neither you nor Claude | 0 % |

Presence comes from the time since your last keyboard or pointer event (macOS). Where the machine does not give it, presence is inferred from your last prompt.

Everything is kept raw: change a ratio, the window or the idle time later and the past is recomputed.

## Commands

| Command | |
| --- | --- |
| `/jrtime` | Open the pane: billable time and amount per category and per project, ratios to adjust with the arrow keys, day/week/month, export |
| `/jrtime rate 90` | Hourly rate for this project |
| `/jrtime rate default 60` | Rate for projects without their own |
| `/jrtime client Acme` | Client name for this project |
| `/jrtime currency $` | Currency symbol (default €) |
| `/jrtime export` | Write the current period to `~/Downloads` as CSV and Markdown |
| `/jrtime hide` / `/jrtime show` | Hide or show the band, in every session; time keeps being recorded |

In the pane: ↑↓ pick a line, ←→ change its value (ratio by 10 %, minutes by 1, rate by 5), tab switches today / week / month, `e` exports. The pane opens with a "click here to use the keyboard" zone: the terminal hands keys over only after a click.

A quiet row on the right above the prompt shows today's billable time and amount for the current project, and how to set a rate until the project has one:

```
                                                  0h47 billable · 39 € · /jrtime
                                   0h47 billable · set a rate: /jrtime rate 80
```

`/jrtime hide` takes it away; turn it off for good in `/config`.

## Install

```
/plugin install jr-time --marketplace jrlprost/claude-code-mods
```

## Access

Reads the time since the last keyboard or pointer event every 30 seconds (`ioreg`, macOS). Keeps its records in the plugin's own store. Writes exports to `~/Downloads` when asked. Sends nothing over the network.
