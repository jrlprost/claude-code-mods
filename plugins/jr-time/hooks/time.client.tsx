// The /jr-time pane, drawn on the surface so it reads raw keys.
// up/down pick a line, left/right change its value (ratio, minutes or hourly rate),
// tab switches today / week / month, e exports, esc closes.
// The terminal hands keys over only after a click, so the pane opens with a focus zone at the bottom.
import type { ClientElements, ClientModule } from 'claude-code'

import type { JrTimeCategory, JrTimeMessage, JrTimePeriod, JrTimeView } from '../types'
import { CATEGORIES, formatHours, formatMoney, LABELS } from './model'

type Props = { view: JrTimeView }
type State = { cursor: number; ready?: boolean }

const BRAND = ['#7f5af0', '#a259e8', '#c658df', '#e85bc4', '#ff5ca8', '#ff7a90', '#ff9a7c', '#ffb86b']
const CATEGORY_COLOR: Record<JrTimeCategory, string> = {
  window: '#7f5af0',
  withYou: '#3da9fc',
  alone: '#4fd6be',
  between: '#2cb67d',
  elsewhere: '#f4d35e',
  break: '#5c5f77',
}
const DIM = '#6b7089'
const KEY = '#ffb86b'
const POINTER = '#ff5ca8'
const MONEY = '#2cb67d'
const ZONE_ROWS = 5
const PERIODS: JrTimePeriod[] = ['today', 'week', 'month']
const BAR = 14

const gradient = (Text: ClientElements['Text'], text: string) =>
  [...text].map((c, i, all) => <Text color={BRAND[Math.floor((i / all.length) * BRAND.length)] ?? POINTER}>{c}</Text>)

type Line =
  | { kind: 'category'; category: JrTimeCategory }
  | { kind: 'setting'; key: 'windowMin' | 'idleMin' }
  | { kind: 'rate'; project: string }

const Time: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const { report, settings } = props.view
  const state: State = surface.state ?? { cursor: 0 }
  const lines: Line[] = [
    ...CATEGORIES.map(category => ({ kind: 'category', category }) as const),
    { kind: 'setting', key: 'windowMin' },
    { kind: 'setting', key: 'idleMin' },
    ...report.projects.map(p => ({ kind: 'rate', project: p.project }) as const),
  ]
  const cursor = Math.min(state.cursor, lines.length - 1)

  const send = (message: JrTimeMessage) => surface.post(message)
  const adjust = (sign: 1 | -1) => {
    const line = lines[cursor]
    if (!line) return
    if (line.kind === 'category') send({ type: 'ratio', category: line.category, delta: sign * 10 })
    else if (line.kind === 'setting') send({ type: 'setting', key: line.key, delta: sign })
    else send({ type: 'rate', project: line.project, delta: sign * 5 })
  }
  const nextPeriod = () => send({ type: 'period', period: PERIODS[(PERIODS.indexOf(report.period) + 1) % PERIODS.length]! })

  surface.onKey(({ key }) => {
    if (!state.ready) surface.setState({ ...state, ready: true })
    if (key === 'up' || key === 'k') surface.setState({ ready: true, cursor: (cursor - 1 + lines.length) % lines.length })
    else if (key === 'down' || key === 'j') surface.setState({ ready: true, cursor: (cursor + 1) % lines.length })
    else if (key === 'left' || key === 'h') adjust(-1)
    else if (key === 'right' || key === 'l') adjust(1)
    else if (key === 'tab' || key === 't') nextPeriod()
    else if (key === 'e') send({ type: 'export' })
  })

  surface.onPointer(event => {
    if (event.type !== 'down') return
    if (!state.ready) return surface.setState({ ...state, ready: true })
    if (event.y === 0) return nextPeriod()
    // Rows start under the tab line and the column titles.
    const index = event.y - 2 - (event.y - 2 >= CATEGORIES.length + 2 ? 1 : 0)
    if (index >= 0 && index < lines.length) surface.setState({ ...state, cursor: index })
  })

  const width = Math.max(56, surface.columns)
  const most = Math.max(1, ...CATEGORIES.map(c => report.categories[c]))
  const pointer = (i: number) => <Text color={POINTER} bold>{i === cursor ? '❯ ' : '  '}</Text>
  const arrows = (i: number, value: string) =>
    i === cursor ? (
      <Text>
        <Text color={KEY}>{'◂ '}</Text>
        <Text bold>{value.padStart(6)}</Text>
        <Text color={KEY}>{' ▸'}</Text>
      </Text>
    ) : (
      <Text>{`  ${value.padStart(6)}  `}</Text>
    )

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between">
        <Text>
          <Text bold>{gradient(Text, 'jr time')}</Text>
          <Text>{'   '}</Text>
          {PERIODS.map(p =>
            p === report.period ? (
              <Text backgroundColor={POINTER} color="black" bold>{` ${p} `}</Text>
            ) : (
              <Text color={DIM}>{` ${p} `}</Text>
            ),
          )}
        </Text>
        <Text color={DIM}>{report.hasPresence ? 'presence: keyboard & pointer' : 'presence: inferred'}</Text>
      </Box>
      <Text color={DIM}>{`  ${''.padEnd(29)}${''.padEnd(BAR + 1)}${'time'.padStart(6)}    ${'ratio'.padStart(6)}    billable`}</Text>
      {CATEGORIES.map((c, i) => {
        const ms = report.categories[c]
        const filled = Math.round((ms / most) * BAR)
        return (
          <Text wrap="truncate-end">
            {pointer(i)}
            <Text color={CATEGORY_COLOR[c]}>{'● '}</Text>
            <Text bold={i === cursor}>{LABELS[c].padEnd(27)}</Text>
            <Text color={CATEGORY_COLOR[c]}>{'█'.repeat(filled)}</Text>
            <Text color={DIM}>{'·'.repeat(BAR - filled)}</Text>
            <Text>{` ${formatHours(ms).padStart(6)}  `}</Text>
            {arrows(i, `${settings.ratios[c]}%`)}
            <Text color={MONEY}>{`  ${formatHours((ms * settings.ratios[c]) / 100)}`}</Text>
          </Text>
        )
      })}
      {(['windowMin', 'idleMin'] as const).map((key, k) => {
        const i = CATEGORIES.length + k
        return (
          <Text>
            {pointer(i)}
            <Text color={DIM}>{'  '}</Text>
            <Text bold={i === cursor}>{(key === 'windowMin' ? 'Prompt window length' : 'Idle after').padEnd(27 + BAR + 9)}</Text>
            {arrows(i, `${settings[key]} min`)}
          </Text>
        )
      })}
      <Text color={DIM}>{'  ' + '─'.repeat(Math.max(10, width - 4))}</Text>
      {report.projects.length === 0 && <Text color={DIM}>{'  No billable time in this period yet.'}</Text>}
      {report.projects.map((p, k) => {
        const i = CATEGORIES.length + 2 + k
        const name = p.client === p.project ? p.project : `${p.project} (${p.client})`
        return (
          <Text wrap="truncate-end">
            {pointer(i)}
            <Text bold={i === cursor}>{name.padEnd(29 + BAR - 6)}</Text>
            <Text>{formatHours(p.billableMs).padStart(6)}</Text>
            <Text>{'  '}</Text>
            {arrows(i, `${p.rate}${settings.currency}/h`)}
            <Text color={MONEY} bold>{`  ${formatMoney(p.amount, settings.currency)}`}</Text>
          </Text>
        )
      })}
      <Text>
        <Text>{'  '}</Text>
        <Text bold>{'Total'.padEnd(29 + BAR - 6)}</Text>
        <Text bold>{formatHours(report.billableMs).padStart(6)}</Text>
        <Text color={MONEY} bold>{`${''.padStart(14)}  ${formatMoney(report.amount, settings.currency)}`}</Text>
      </Text>
      <Text wrap="truncate-end">
        <Text color={KEY} bold>↑↓</Text>
        <Text color={DIM}>{' line   '}</Text>
        <Text color={KEY} bold>←→</Text>
        <Text color={DIM}>{' change   '}</Text>
        <Text color={KEY} bold>tab</Text>
        <Text color={DIM}>{' period   '}</Text>
        <Text color={KEY} bold>e</Text>
        <Text color={DIM}>{' export CSV + Markdown   '}</Text>
        <Text color={KEY} bold>esc</Text>
        <Text color={DIM}>{' close'}</Text>
      </Text>
      {!state.ready && (
        <Box borderStyle="round" borderColor={POINTER} height={ZONE_ROWS} justifyContent="center" alignItems="center">
          <Text bold>{gradient(Text, '⌨  click here to use the keyboard')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Time
