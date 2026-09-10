export { ChmArchive } from './core/chm-archive'
export { decodeText, detectEncoding } from './core/encoding'
export { isExternalReference, isHtmlPath, normalizeChmPath, splitReference } from './core/path'
export { mediaTypeForPath } from './core/media'
export type {
  ChmEntry,
  ChmMetadata,
  ChmOpenOptions,
  ChmRenderedPage,
  ChmSearchOptions,
  ChmSearchResult,
  ChmSource,
  ChmTocItem,
} from './core/types'
