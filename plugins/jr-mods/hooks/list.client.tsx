// The /jrmods list, drawn on the surface itself so it reads raw keys:
// up/down (or j/k) move, space ticks, enter applies, a/n tick all or none.
// A click on a row ticks it (and gives the list the keys); a click on the last line applies.
import type { ClientModule } from 'claude-code'

import type { JrModsItem } from '../types'

type Props = { items: JrModsItem[] }
type State = { cursor: number; wanted: Record<string, boolean> }

const BRAND = ['#7f5af0', '#a259e8', '#c658df', '#e85bc4', '#ff5ca8', '#ff7a90', '#ff9a7c', '#ffb86b']
const ON = '#2cb67d'
const DIM = '#6b7089'
const KEY = '#ffb86b'
const POINTER = '#ff5ca8'

const List: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const items = props.items
  const state: State = surface.state ?? { cursor: 0, wanted: Object.fromEntries(items.map(i => [i.id, i.enabled])) }
  const isOn = (item: JrModsItem) => state.wanted[item.id] ?? item.enabled
  const changes = items.filter(item => isOn(item) !== item.enabled).length

  surface.onKey(({ key }) => {
    const move = (d: number) => surface.setState({ ...state, cursor: (state.cursor + d + items.length) % Math.max(1, items.length) })
    const item = items[state.cursor]
    if (key === 'up' || key === 'k') move(-1)
    else if (key === 'down' || key === 'j') move(1)
    else if (key === ' ' && item) surface.setState({ ...state, wanted: { ...state.wanted, [item.id]: !isOn(item) } })
    else if (key === 'a' || key === 'n') surface.setState({ ...state, wanted: Object.fromEntries(items.map(i => [i.id, key === 'a'])) })
    else if (key === 'return') surface.post({ type: 'apply', wanted: state.wanted })
  })

  const width = Math.max(40, surface.columns)
  const nameWidth = Math.min(28, Math.max(...items.map(i => i.name.length), 8) + 2)
  // Fill the pane: every row but the header and the footer lists plugins, the cursor kept in view.
  const room = surface.rows > 0 ? Math.max(3, surface.rows - 2) : items.length
  const start = Math.min(Math.max(0, state.cursor - Math.floor(room / 2)), Math.max(0, items.length - room))
  const visible = items.slice(start, start + room)

  surface.onPointer(event => {
    if (event.type !== 'down') return
    const row = event.y - 1
    const item = visible[row]
    if (item) {
      surface.setState({ cursor: start + row, wanted: { ...state.wanted, [item.id]: !isOn(item) } })
    } else if (event.y === visible.length + 1) {
      surface.post({ type: 'apply', wanted: state.wanted })
    }
  })
  const onCount = items.filter(isOn).length

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between">
        <Text bold>
          {[...'jr mods'].map((c, i) => (
            <Text color={BRAND[i] ?? BRAND[BRAND.length - 1]}>{c}</Text>
          ))}
        </Text>
        <Text color={DIM}>{`${onCount} on · ${items.length - onCount} off`}</Text>
      </Box>
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
      <Text>
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
    </Box>
  )
}

export default List
