// Files Claude reads whole on purpose: images, PDFs, notebooks. Their line count means nothing.
const SKIP = /\.(png|jpe?g|gif|webp|svg|ico|pdf|ipynb|heic|bmp|tiff?)$/i

export type ReadInput = { file_path: string; offset?: number; limit?: number; pages?: string; allow_large?: boolean }

/** True when this Read would take the whole file and the cap applies to it. */
export const isWholeRead = (e: ReadInput, respectAllowLarge: boolean) =>
  e.offset === undefined && e.limit === undefined && e.pages === undefined && !(respectAllowLarge && e.allow_large) && !SKIP.test(e.file_path)

export const countLines = (text: string) => (text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0))

export const denial = (file: string, lines: number | null, cap: number) =>
  `jr-read-cap: ${file} has ${lines === null ? 'more than 4 MB of text' : `${lines.toLocaleString('en-US')} lines`}, over the ${cap.toLocaleString('en-US')}-line cap for whole-file reads. ` +
  `Search it first (Grep for the symbol or text you need), then Read only that range with offset and limit (for example limit: 300).`
