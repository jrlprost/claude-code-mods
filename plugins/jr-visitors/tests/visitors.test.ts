import { test, expect } from 'claude-code/testing'

import { printable } from '../hooks/jr/text'

test('outside text is drawn printable: escape sequences and line breaks cannot reach the terminal', async () => {
  expect(printable('/pricing\u001b[2J\u001b[31mHACKED')).toBe('/pricing�[2J�[31mHACKED')
  expect(printable('/a\r\n/b')).toBe('/a��/b')
  expect(printable('/café\t/ok')).toBe('/café\t/ok')
  expect(printable('x'.repeat(300), 10)).toBe('xxxxxxxxx…')
})
