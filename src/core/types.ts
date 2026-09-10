export type ChmSource = Blob | ArrayBuffer | Uint8Array

export interface ChmOpenOptions {
  /** Fallback encoding for old CHM files without a charset declaration. */
  encoding?: string
  /** Remove scripts, event handlers and unsafe URLs before rendering. */
  sanitize?: boolean
  /** Number of decompressed blocks retained by chmlib-ts. */
  cacheSize?: number
}

export interface ChmMetadata {
  title?: string
  defaultTopic?: string
  tocFile?: string
  indexFile?: string
  compiledFile?: string
}

export interface ChmEntry {
  path: string
  length: bigint
  compressed: boolean
  mediaType: string
}

export interface ChmTocItem {
  id: string
  label: string
  path?: string
  children: ChmTocItem[]
}

export interface ChmRenderedPage {
  path: string
  title: string
  html: string
}

export interface ChmSearchOptions {
  limit?: number
  signal?: AbortSignal
  onProgress?: (completed: number, total: number) => void
}

export interface ChmSearchResult {
  path: string
  title: string
  excerpt: string
  score: number
}
