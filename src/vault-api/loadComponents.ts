/**
 * Loading a vault's component folders into the registry (vault components plan, V2), the same in
 * the app and on the server: each folder's module runs inside a capture, what it defined is
 * checked against the folder rule, and a folder that fails is left out with its message, so a
 * built-in of the same name stays in use.
 */
import { checkFolderDefinitions } from '@shared/vaultComponents.ts'
import { parseVaultTemplate, type VaultTemplateFile } from '@shared/vaultTemplates.ts'
import { captureDefinitions, getAllTemplates, registerSource, type ComponentDefinition, type ComponentProblem, type RegistryConfig } from '../components/slides/defineComponent'

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

export interface VaultEntries {
  /** Folders whose code may not run yet: listed as problems, so their slides get placeholders. */
  blocked?: readonly string[]
  blockedMessage?: string
  /** The vault's template files; they load whether or not its components may run. */
  templates?: readonly VaultTemplateFile[]
}

/**
 * The vault's templates as registry entries. A broken file, a name used twice, or an id another
 * entry already has under a different name (the gallery and palette key by id) is a problem.
 */
export function templateEntries(templates: readonly VaultTemplateFile[]): { templates: RegistryConfig[]; problems: ComponentProblem[] } {
  const entries: RegistryConfig[] = []
  const problems: ComponentProblem[] = []
  const builtins = getAllTemplates(null)
  for (const file of templates) {
    const parsed = parseVaultTemplate(file)
    if (parsed.error !== undefined) {
      problems.push({ name: parsed.name, message: parsed.error, template: true })
      continue
    }
    const t = parsed.template
    const clash = builtins.find((b) => b.id === t.id && b.name !== t.name)
    if (clash) problems.push({ name: t.name, message: `Its id ${t.id} (from the folder name) is the built-in template ${clash.name}'s; rename the folder, or name it ${clash.name} to replace that one`, template: true })
    else if (entries.some((e) => e.name === t.name)) problems.push({ name: t.name, message: `Another template in this vault is also named ${t.name}`, template: true })
    else entries.push({ ...t, category: 'template', props: [] })
  }
  return { templates: entries, problems }
}

/** Registers a vault: its loaded component folders and its templates; failures become problems. */
export function registerFolders(vault: string, folders: readonly LoadedFolder[], options: VaultEntries = {}): void {
  const { blocked = [], blockedMessage = BLOCKED_MESSAGE } = options
  const templates = templateEntries(options.templates ?? [])
  const problems: ComponentProblem[] = [
    ...folders.filter((f) => f.error !== undefined).map((f) => ({ name: f.name, message: f.error! })),
    ...blocked.map((name) => ({ name, message: blockedMessage, blocked: true })),
    ...templates.problems,
  ]
  registerSource(vault, { components: folders.flatMap((f) => f.components), templates: templates.templates }, problems)
}
