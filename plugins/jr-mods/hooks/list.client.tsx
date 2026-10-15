// The /jrmods list, drawn on the surface itself so it reads raw keys:
// left/right (or h/l, tab) switch between mods and plugins, up/down (or j/k) move,
// space ticks, a/n tick all or none of the tab, enter applies every change at once.
// The terminal hands the keys to the list only after a click on it, so the list opens with a
// focus zone at the bottom: the first click lands anywhere and ticks nothing. After it, a click
// on the tab line switches tabs, a click on a row ticks it and a click on the last line applies.
import type { ClientElements, ClientModule } from 'claude-code'

import type { JrModsItem, JrModsKind } from '../types'

type Props = { items: JrModsItem[] }
type State = { tab: JrModsKind; cursor: number; wanted: Record<string, boolean>; ready?: boolean }

const BRAND = ['#7f5af0', '#a259e8', '#c658df', '#e85bc4', '#ff5ca8', '#ff7a90', '#ff9a7c', '#ffb86b']
const ON = '#2cb67d'
const DIM = '#6b7089'
const KEY = '#ffb86b'
const POINTER = '#ff5ca8'
const ZONE_ROWS = 5
const TABS: JrModsKind[] = ['mod', 'plugin']
const TAB_LABEL: Record<JrModsKind, string> = { mod: 'mods', plugin: 'plugins' }

const gradient = (Text: ClientElements['Text'], text: string) =>
  [...text].map((c, i, all) => <Text color={BRAND[Math.floor((i / all.length) * BRAND.length)] ?? POINTER}>{c}</Text>)

const List: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const all = props.items
  const firstTab: JrModsKind = all.some(i => i.kind === 'mod') ? 'mod' : 'plugin'
  const state: State = surface.state ?? { tab: firstTab, cursor: 0, wanted: Object.fromEntries(all.map(i => [i.id, i.enabled])) }
  const isOn = (item: JrModsItem) => state.wanted[item.id] ?? item.enabled
  const items = all.filter(i => i.kind === state.tab)
  const changes = all.filter(item => isOn(item) !== item.enabled).length

  const switchTab = () => surface.setState({ ...state, ready: true, tab: state.tab === 'mod' ? 'plugin' : 'mod', cursor: 0 })

  surface.onKey(({ key }) => {
    const move = (d: number) => surface.setState({ ...state, ready: true, cursor: (state.cursor + d + items.length) % Math.max(1, items.length) })
    const item = items[state.cursor]
    if (key === 'up' || key === 'k') move(-1)
    else if (key === 'down' || key === 'j') move(1)
    else if (key === 'left' || key === 'right' || key === 'h' || key === 'l' || key === 'tab') switchTab()
    else if ((key === ' ' || key === 'space') && item) surface.setState({ ...state, ready: true, wanted: { ...state.wanted, [item.id]: !isOn(item) } })
    else if (key === 'a' || key === 'n') surface.setState({ ...state, ready: true, wanted: { ...state.wanted, ...Object.fromEntries(items.map(i => [i.id, key === 'a'])) } })
    else if (key === 'return' || key === 'enter') surface.post({ type: 'apply', wanted: state.wanted })
  })

  const width = Math.max(40, surface.columns)
  const nameWidth = Math.min(28, Math.max(...items.map(i => i.name.length), 8) + 2)
  // Fill the pane: every row but the tab line and the footer lists the tab, the cursor kept in view.
  const zone = state.ready ? 0 : ZONE_ROWS
  const room = surface.rows > 0 ? Math.max(3, surface.rows - 2 - zone) : Math.max(1, items.length)
  const start = Math.min(Math.max(0, state.cursor - Math.floor(room / 2)), Math.max(0, items.length - room))
  const visible = items.slice(start, start + room)
  const listRows = Math.max(1, visible.length)

  surface.onPointer(event => {
    if (event.type !== 'down') return
    // The first click only takes the keyboard.
    if (!state.ready) return surface.setState({ ...state, ready: true })
    if (event.y === 0) return switchTab()
    const item = visible[event.y - 1]
    if (item) surface.setState({ ...state, cursor: start + event.y - 1, wanted: { ...state.wanted, [item.id]: !isOn(item) } })
    else if (event.y === listRows + 1) surface.post({ type: 'apply', wanted: state.wanted })
  })

  const onCount = items.filter(isOn).length

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between">
        <Text>
          <Text bold>{gradient(Text, 'jr mods')}</Text>
          <Text>{'   '}</Text>
          {TABS.map(tab => {
            const count = all.filter(i => i.kind === tab).length
            return tab === state.tab ? (
              <Text backgroundColor={POINTER} color="black" bold>{` ${TAB_LABEL[tab]} ${count} `}</Text>
            ) : (
              <Text color={DIM}>{` ${TAB_LABEL[tab]} ${count} `}</Text>
            )
          })}
        </Text>
        <Text color={DIM}>{`${onCount} on · ${items.length - onCount} off`}</Text>
      </Box>
      {visible.length === 0 && <Text color={DIM}>{`  no ${TAB_LABEL[state.tab]} installed`}</Text>}
      {visible.map((item, i) => {
        const isCursor = start + i === state.cursor
        const on = isOn(item)
        const changed = on !== item.enabled
        return (
          <Text wrap="truncate-end">
            <Text color={POINTER} bold>{isCursor ? '❯ ' : '  '}</Text>
            <Text color={on ? ON : DIM}>{on ? '◉ ' : '○ '}</Text>
            <Text bold={isCursor} color={changed ? KEY : undefined}>{item.name.padEnd(nameWidth)}</Text>
            <Text color={DIM}>{item.description || item.source}</Text>
          </Text>
        )
      })}
      <Text wrap="truncate-end">
        <Text color={KEY} bold>←→</Text>
        <Text color={DIM}>{' mods/plugins   '}</Text>
        <Text color={KEY} bold>space</Text>
        <Text color={DIM}>{' toggle   '}</Text>
        <Text color={KEY} bold>↑↓</Text>
        <Text color={DIM}>{' move   '}</Text>
        <Text color={KEY} bold>a/n</Text>
        <Text color={DIM}>{' all/none   '}</Text>
        <Text color={KEY} bold>enter</Text>
        <Text color={DIM}>{changes ? ` apply ${changes} change${changes > 1 ? 's' : ''}   ` : ' apply   '}</Text>
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

export default List
