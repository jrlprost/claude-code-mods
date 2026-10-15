import type { EngineInterface, Register } from 'claude-code'

import { IMAGE, isTooLarge, parseSips, resizedPath } from './image'

const DIR = '/tmp/jr-image-guard'

async function sizeOf($: EngineInterface, file: string) {
  const { exitCode, stdout } = await $.process.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', file])
  return exitCode === 0 ? parseSips(stdout) : null
}

/** A copy that fits in `max` on both axes: ImageMagick when present, sips otherwise. */
async function shrink($: EngineInterface, file: string, max: number) {
  await $.process.run(['mkdir', '-p', DIR])
  const out = resizedPath(DIR, file, await $.clock.now())
  const magick = await $.process.run(['sh', '-c', 'command -v magick >/dev/null && magick "$0" -resize "$1x$1>" "$2"', file, String(max), out])
  if (magick.exitCode === 0) return out
  const sips = await $.process.run(['sips', '-Z', String(max), file, '--out', out])
  return sips.exitCode === 0 ? out : null
}

export const register: Register = (on, options) => {
  const max = Number(options.maxPixels ?? 7800)

  // Images over the limit break the conversation: Claude reads a resized copy instead.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (!IMAGE.test(e.file_path)) return next(e)
    const size = await sizeOf($, e.file_path)
    if (!isTooLarge(size, max)) return next(e)
    const copy = await shrink($, e.file_path, max)
    if (!copy) return { deny: `jr-image-guard: ${e.file_path} is ${size![0]}×${size![1]} px, over ${max} px, and could not be resized.` }
    $.ui.toast(`jr image guard · ${size![0]}×${size![1]} px → resized to fit ${max} px`)
    return next({ ...e, file_path: copy })
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'jr-image-guard: the size check failed, so the image was not read.' }))

  // A browser viewport over the limit makes screenshots that break the conversation.
  on('tool.call', { tool: 'mcp__playwright__browser_resize' }, ($, e, next) => {
    const { width, height } = e as unknown as { width?: number; height?: number }
    if ((width ?? 0) > max || (height ?? 0) > max) {
      return { deny: `jr-image-guard: a ${width}×${height} viewport is over ${max} px; screenshots that size break the conversation. Use ${max} px or less.` }
    }
    return next(e)
  })
}
