/**
 * Loading a vault's component folders into the registry (vault components plan, V2), the same in
 * the app and on the server: each folder's module runs inside a capture, what it defined is
 * checked against the folder rule, and a folder that fails is left out with its message, so a
 * built-in of the same name stays in use.
 */
import { checkFolderDefinitions } from '@shared/vaultComponents.ts'
import { captureDefinitions, registerSource, type ComponentDefinition, type ComponentProblem } from '../components/slides/defineComponent'

export interface LoadedFolder {
  name: string
  hash: string
  components: ComponentDefinition<any>[]
  error?: string
}

const LOAD_FAILED = 'Failed to load: '

/**
 * Whether a loaded folder can be kept while its hash is unchanged. A compile or folder-rule error
 * is the same next time; a failure while running it may not be (it can depend on what else was
 * loading), so that one is tried again.
 */
export const reusable = (folder: LoadedFolder | undefined, hash: string): folder is LoadedFolder => !!folder && folder.hash === hash && !folder.error?.startsWith(LOAD_FAILED)

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Runs one folder's module (`load` imports it) and checks what it defined. */
export async function loadFolder(name: string, hash: string, load: () => Promise<unknown>): Promise<LoadedFolder> {
  try {
    const entries = await captureDefinitions(load)
    const problems = checkFolderDefinitions(name, entries.components.map((c) => c.registry))
    if (entries.templates.length) problems.push('defineTemplate cannot be used in a component; templates are MDX files in templates/<id>/')
    if (problems.length) return { name, hash, components: [], error: problems.join('\n') }
    return { name, hash, components: entries.components }
  } catch (error) {
    return { name, hash, components: [], error: `${LOAD_FAILED}${messageOf(error)}` }
  }
}

export const BLOCKED_MESSAGE = "this vault's components are blocked (Settings › Vaults)"
export const UNDECIDED_MESSAGE = "this vault's components have not been allowed to run yet"

/** Registers a vault's folders as its source; the ones with an error become problems. */
export function registerFolders(vault: string, folders: readonly LoadedFolder[], blocked: readonly string[] = [], blockedMessage = BLOCKED_MESSAGE): void {
  const problems: ComponentProblem[] = [
    ...folders.filter((f) => f.error !== undefined).map((f) => ({ name: f.name, message: f.error! })),
    ...blocked.map((name) => ({ name, message: blockedMessage, blocked: true })),
  ]
  registerSource(vault, { components: folders.flatMap((f) => f.components) }, problems)
}
