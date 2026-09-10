const CHARSET_ALIASES: Record<string, string> = {
  gb2312: 'gb18030',
  gbk: 'gb18030',
  'x-gbk': 'gb18030',
  'windows-936': 'gb18030',
  big5: 'big5',
  'windows-950': 'big5',
  latin1: 'windows-1252',
}

export function detectEncoding(data: Uint8Array, fallback = 'gb18030'): string {
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) return 'utf-8'
  if (data[0] === 0xff && data[1] === 0xfe) return 'utf-16le'
  if (data[0] === 0xfe && data[1] === 0xff) return 'utf-16be'

  const header = new TextDecoder('windows-1252').decode(data.subarray(0, Math.min(data.length, 4096)))
  const declared = header.match(/<meta[^>]+charset\s*=\s*["']?\s*([^\s"'/>;]+)/i)?.[1]
    ?? header.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';>]+)/i)?.[1]
    ?? header.match(/<\?xml[^>]+encoding\s*=\s*["']([^"']+)/i)?.[1]
  if (declared) return normalizeEncoding(declared)

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data)
    return 'utf-8'
  } catch {
    return normalizeEncoding(fallback)
  }
}

export function decodeText(data: Uint8Array, fallback = 'gb18030'): string {
  const encoding = detectEncoding(data, fallback)
  try {
    return new TextDecoder(encoding).decode(data).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('utf-8').decode(data).replace(/^\uFEFF/, '')
  }
}

function normalizeEncoding(value: string): string {
  const normalized = value.trim().toLowerCase()
  return CHARSET_ALIASES[normalized] ?? normalized
}
