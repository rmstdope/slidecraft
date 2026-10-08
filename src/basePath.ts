/**
 * Base-path helpers (Part 1 §14.3, Part 3 §1.1). BASE is Vite's base URL without the trailing
 * slash: '' at the origin root, '/<repo>/app' on static hosting.
 */
const env = (import.meta as ImportMeta & { env?: Partial<ImportMetaEnv> }).env

export const BASE = (env?.BASE_URL ?? '/').replace(/\/$/, '')
export const IS_STATIC = env?.VITE_STATIC === '1'

/** Prefix an app-absolute path with BASE. data: and absolute URLs pass through untouched. */
export function appPath(path: string, base = BASE): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  return base + path
}

/** Pathname minus BASE and the leading slash: '', 'gallery', 'edit/<name>', '<name>', 'chat/<name>'. */
export function stripBase(pathname: string, base = BASE): string {
  let path = pathname
  if (base && (path === base || path.startsWith(base + '/'))) path = path.slice(base.length)
  return path.replace(/^\/+/, '')
}

export const routePath = (): string => stripBase(window.location.pathname)
