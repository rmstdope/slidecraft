/**
 * Vault components (vault components plan, V2): what the server and the app agree on. A vault's
 * `components/<Name>/index.tsx` is bundled by the server and imported by the app (and by the
 * server itself, for the tools and checks).
 */

import type { VaultTemplateFile } from './vaultTemplates.ts'

/** Whether a vault's components may run: set per vault in config.json, or not decided yet. */
export type ComponentTrust = 'trusted' | 'blocked' | 'ask'

export const COMPONENTS_DIR = 'components'
export const COMPONENT_ENTRY = 'index.tsx'

/** A component folder's name: the component's PascalCase name. */
export const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/

export interface VaultComponentInfo {
  /** The folder name, which is the component's name. */
  name: string
  /** Of the folder's code files; changes whenever one does. */
  hash: string
  /** The bundle, when the vault is trusted and the folder compiled. */
  url?: string
  /** Why the folder did not compile. */
  error?: string
}

export interface VaultComponentsListing {
  vault: string
  trust: ComponentTrust
  components: VaultComponentInfo[]
  /** `templates/<id>/index.mdx` files (V3): text, listed whatever the trust. */
  templates: VaultTemplateFile[]
}

const encodeSegment = (s: string) => encodeURIComponent(s)

/** Where a component's bundle is served, below the app's base path. */
export const componentBundleUrl = (vault: string, name: string, hash: string): string =>
  `/content-source/${encodeSegment(vault)}/${COMPONENTS_DIR}/${encodeSegment(name)}/index.js?h=${hash}`

/** `components/<Name>/index.js` inside a vault, as the bundle route sees the path. */
export function bundleRequestName(rest: string): string | undefined {
  const match = /^components\/([^/]+)\/index\.js$/.exec(rest)
  if (!match) return undefined
  let name: string
  try {
    name = decodeURIComponent(match[1])
  } catch {
    return undefined
  }
  return COMPONENT_NAME_RE.test(name) ? name : undefined
}

/**
 * What a component folder may define: the component named like the folder, and parts of it
 * (`parent` set to the folder name). Returns one message per problem.
 */
export function checkFolderDefinitions(folder: string, defined: readonly { name: string; parent?: string; category?: string }[]): string[] {
  const problems: string[] = []
  if (!defined.some((d) => d.name === folder)) problems.push(`index.tsx does not define the component ${folder} (call defineComponent with name '${folder}')`)
  for (const d of defined) {
    if (d.name !== folder && d.parent !== folder) problems.push(`${d.name} is defined in components/${folder}/ but is not ${folder} or a part of it (set parent: '${folder}')`)
  }
  const seen = new Set<string>()
  for (const d of defined) {
    if (seen.has(d.name)) problems.push(`${d.name} is defined twice`)
    seen.add(d.name)
  }
  return problems
}
