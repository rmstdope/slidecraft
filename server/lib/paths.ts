/**
 * Process-level configuration (Part 4 §3.1): flags, environment, config file, port and the app's
 * own directories. Flags accept both `--flag value` and `--flag=value`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { API_PORT, DEFAULT_API_PORT } from '../../shared/ports.ts'
import { embedded } from '../embedded.generated.ts'

export const APP_ID = 'slidecraft'
export const VERSION = process.env.SLIDECRAFT_VERSION ?? 'dev'

export function argValue(flag: string, args = process.argv.slice(2)): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) return args[i + 1]
    if (args[i].startsWith(`${flag}=`)) return args[i].slice(flag.length + 1)
  }
  return undefined
}

export const hasFlag = (flag: string, args = process.argv.slice(2)): boolean => args.includes(flag)

/** True only inside the compiled release binary, which carries the app files in an embedded table. */
export const IS_BUNDLED = Object.keys(embedded).length > 0

export const PORT = Number(argValue('--port') ?? (IS_BUNDLED ? (process.env.PORT ?? DEFAULT_API_PORT) : API_PORT))

export const APP_ROOT = process.cwd()
export const PUBLIC_DIR = join(APP_ROOT, 'public')
export const DIST_DIR = join(APP_ROOT, 'dist')
export const DOCS_DIR = join(APP_ROOT, 'docs')

/** Where decks live when nothing else is configured: the repo's examples, or the working directory. */
export const FALLBACK_CONTENT_DIR = IS_BUNDLED ? process.cwd() : join(APP_ROOT, 'content')

export const expandHome = (path: string): string => (path === '~' ? homedir() : path.startsWith('~/') ? join(homedir(), path.slice(2)) : path)

export const CONFIG_FILE = resolve(expandHome(process.env.SLIDECRAFT_CONFIG ?? '~/.config/slidecraft/config.json'))

export interface SourceDescriptor {
  path: string
  include?: string | string[]
  readOnly?: boolean
}

export interface AppConfig {
  default?: string
  contents?: Record<string, string | SourceDescriptor>
  /** Defaults for the Copilot CLI chat provider (Phase 10). */
  copilot?: { model?: string; effort?: string }
}

/** Forgiving: a missing or malformed file is an empty config. */
export function readConfig(file = CONFIG_FILE): AppConfig {
  try {
    if (!existsSync(file)) return {}
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as AppConfig) : {}
  } catch {
    return {}
  }
}

/** The content directory asked for on the command line or in the environment. */
export const requestedContent = (): string | undefined => argValue('--content') ?? process.env.SLIDECRAFT_CONTENT_DIR ?? undefined
