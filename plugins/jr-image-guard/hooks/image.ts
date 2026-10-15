export const IMAGE = /\.(png|jpe?g|webp|gif|tiff?|heic|bmp)$/i

/** `sips -g pixelWidth -g pixelHeight` output → [width, height], or null. */
export const parseSips = (stdout: string): [number, number] | null => {
  const w = stdout.match(/pixelWidth:\s*(\d+)/)
  const h = stdout.match(/pixelHeight:\s*(\d+)/)
  return w && h ? [Number(w[1]), Number(h[1])] : null
}

export const isTooLarge = (size: [number, number] | null, max: number) => !!size && (size[0] > max || size[1] > max)

export const resizedPath = (dir: string, file: string, stamp: number) => `${dir}/${stamp}-${file.split('/').pop() ?? 'image.png'}`
