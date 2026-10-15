// Drawing helpers shared by every jr mod. Synced into each plugin's hooks/jr/.
import type { Elements } from 'claude-code'

import { bar, paint } from './gradient'

type TextElement = Elements['terminal']['Text']

/** `text` in a gradient, one color per character, bold by default. */
export const gradientText = (Text: TextElement, text: string, stops: readonly string[], bold = true) => (
  <Text bold={bold}>
    {paint(text, stops).map(({ char, color }) => (
      <Text color={color}>{char}</Text>
    ))}
  </Text>
)

/** A gauge: filled cells in the gradient, empty cells dim. */
export const gauge = (Text: TextElement, ratio: number, width: number, stops: readonly string[]) => (
  <Text>
    {bar(ratio, width, stops).map(cell =>
      cell.empty ? (
        <Text color={cell.color} dimColor>
          {cell.char}
        </Text>
      ) : (
        <Text color={cell.color}>{cell.char}</Text>
      ),
    )}
  </Text>
)

/** The jr tag that opens every band line: a small gradient label. */
export const tag = (Text: TextElement, label: string, stops: readonly string[]) =>
  gradientText(Text, `${label} `, stops)
