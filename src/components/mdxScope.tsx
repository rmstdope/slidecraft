import type { ComponentProps, FC } from 'react'
import * as slideComponents from './slides'
import { BUILTIN_SOURCE, getActiveVault, getAllComponents, getRegistryVersion, sourceOfEntry } from './slides/defineComponent'

/**
 * The MDX component scope (Part 1 §13.1). `p` becomes a div because MDX wraps block content
 * in paragraphs, which would otherwise nest divs inside <p>.
 */
const builtinScope = {
  p: (props: ComponentProps<'div'>) => <div {...props} />,
  ...slideComponents,
}

export type MdxComponentScope = typeof builtinScope

const cache = new Map<string, { version: number; scope: MdxComponentScope }>()

/**
 * The scope for a vault (the active one when none is passed): the built-ins, with that vault's
 * components added and replacing built-ins of the same name. Read it when compiling or
 * rendering, never once at module load, so vault components that register later are seen.
 */
export function getMdxScope(vault?: string | null): MdxComponentScope {
  // undefined means the active vault, null means none: different scopes, different keys.
  const resolved = vault === undefined ? getActiveVault() : vault
  const key = resolved ?? ''
  const version = getRegistryVersion()
  const hit = cache.get(key)
  if (hit && hit.version === version) return hit.scope
  const own: Record<string, FC<any>> = {}
  for (const c of getAllComponents(resolved)) if (sourceOfEntry(c.registry) !== BUILTIN_SOURCE) own[c.registry.name] = c.Component
  const scope = Object.keys(own).length ? { ...builtinScope, ...own } : builtinScope
  cache.set(key, { version, scope })
  return scope
}

/** The built-in scope; for tests and tools that never see a vault. */
export const builtinMdxScope: MdxComponentScope = builtinScope
