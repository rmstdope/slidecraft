/**
 * Copying a built-in into a vault, comparing the copy with it, and resetting to it (vault
 * components plan, V5). A copy is an ordinary vault component or template folder plus a
 * `.slidecraft-origin.json`; resetting deletes the folder, so the built-in is in use again.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUILTIN_SOURCE_DIR,
  copySource,
  ORIGIN_FILE,
  templateCopyText,
  templateFolderOf,
  textHash,
  type BuiltinCopiesManifest,
  type ComponentOrigin,
  type CopyPlan,
  type EntryKind,
  type OriginInfo,
} from '../../shared/builtinCopies.ts'
import manifest from '../../shared/builtinCopies.json'
import { COMPONENT_ENTRY, COMPONENT_NAME_RE, COMPONENTS_DIR } from '../../shared/vaultComponents.ts'
import { parseVaultTemplate, TEMPLATE_ENTRY, TEMPLATE_ID_RE, TEMPLATES_DIR } from '../../shared/vaultTemplates.ts'
import { getAllTemplates, getBuiltinComponent, type RegistryConfig } from '../../src/components/slides/defineComponent.ts'
import '../../src/components/slides/index.ts'
import { readAppText } from './appFiles.ts'
import { VaultError, type ContentSource } from './contentSources.ts'
import { discoverSource } from './decks.ts'
import { VERSION } from './paths.ts'

const copies = manifest as BuiltinCopiesManifest

export type { CopyPlan, EntryKind }

const builtinTemplate = (name: string): RegistryConfig | undefined => getAllTemplates(null).find((t) => t.name === name || templateFolderOf(t) === name)

/** The text a copy is made from now: the built-in's source file, or its template text. */
function currentText(kind: EntryKind, name: string): string | undefined {
  if (kind === 'template') {
    const template = builtinTemplate(name)
    return template ? templateCopyText(template) : undefined
  }
  const entry = copies.components[name]
  return entry?.file ? (readAppText(`${BUILTIN_SOURCE_DIR}/${entry.file}`) ?? undefined) : undefined
}

const folderPath = (source: ContentSource, kind: EntryKind, folder: string) => join(source.path, kind === 'component' ? COMPONENTS_DIR : TEMPLATES_DIR, folder)

async function decksUsing(source: ContentSource, kind: EntryKind, name: string): Promise<number> {
  // A template is copied into a slide, not used by name, so no deck changes with it.
  if (kind === 'template') return 0
  const tag = new RegExp(`<${name}[\\s/>]`)
  let count = 0
  for (const deck of await discoverSource(source)) {
    try {
      if (tag.test(readFileSync(join(source.path, deck.path, 'index.mdx'), 'utf8'))) count++
    } catch {
      /* gone */
    }
  }
  return count
}

export async function copyPlan(source: ContentSource, kind: EntryKind, name: string): Promise<CopyPlan> {
  if (kind === 'template') {
    const template = builtinTemplate(name)
    if (!template) throw new VaultError(404, `No built-in template "${name}"`)
    const id = templateFolderOf(template)
    return { kind, name: template.name, folder: `${TEMPLATES_DIR}/${id}`, copyable: true, parts: [], decks: 0, exists: existsSync(folderPath(source, kind, id)) }
  }
  const entry = copies.components[name]
  if (!entry || !getBuiltinComponent(name)) throw new VaultError(404, `No built-in component "${name}"`)
  const base = { kind, name, folder: `${COMPONENTS_DIR}/${name}`, exists: existsSync(folderPath(source, kind, name)), decks: await decksUsing(source, kind, name) }
  if (entry.reason !== undefined) return { ...base, copyable: false, reason: entry.reason, parts: [] }
  if (currentText(kind, name) === undefined) return { ...base, copyable: false, reason: `This build of Slidecraft does not carry ${name}'s source.`, parts: entry.parts }
  return { ...base, copyable: true, parts: entry.parts }
}

/** Writes the vault copy of a built-in and its origin record; returns the folder. */
export async function copyBuiltin(source: ContentSource, kind: EntryKind, name: string): Promise<CopyPlan> {
  if (source.readOnly) throw new VaultError(403, `The vault "${source.name}" is read-only`)
  const plan = await copyPlan(source, kind, name)
  if (!plan.copyable) throw new VaultError(400, plan.reason ?? `${name} cannot be copied`)
  if (plan.exists) throw new VaultError(409, `${plan.folder}/ already exists in this vault`)
  const text = currentText(kind, plan.name)!
  const folder = plan.folder.split('/')[1]
  const dir = folderPath(source, kind, folder)
  mkdirSync(dir, { recursive: true })
  const origin: ComponentOrigin = { kind, builtin: plan.name, appVersion: VERSION, hash: textHash(text), copiedAt: new Date().toISOString() }
  // The origin first: the folder's code appearing is what reloads the vault.
  writeFileSync(join(dir, ORIGIN_FILE), `${JSON.stringify(origin, null, 2)}\n`)
  writeFileSync(join(dir, kind === 'component' ? COMPONENT_ENTRY : TEMPLATE_ENTRY), kind === 'component' ? copySource(text, plan.name, VERSION) : text)
  return { ...plan, exists: true }
}

/** A folder's origin record, if it was copied from a built-in and the record reads. */
export function readOrigin(source: ContentSource, kind: EntryKind, folder: string): ComponentOrigin | undefined {
  try {
    const value = JSON.parse(readFileSync(join(folderPath(source, kind, folder), ORIGIN_FILE), 'utf8')) as Partial<ComponentOrigin>
    if (typeof value.builtin !== 'string' || typeof value.hash !== 'string') return undefined
    return { kind, builtin: value.builtin, hash: value.hash, appVersion: String(value.appVersion ?? ''), copiedAt: String(value.copiedAt ?? '') }
  } catch {
    return undefined
  }
}

/** The origin as the listing reports it, with whether the built-in has changed since. */
export function originInfo(source: ContentSource, kind: EntryKind, folder: string): OriginInfo | undefined {
  const origin = readOrigin(source, kind, folder)
  if (!origin) return undefined
  const now = currentText(kind, origin.builtin)
  return { builtin: origin.builtin, appVersion: origin.appVersion, copiedAt: origin.copiedAt, changed: now !== undefined && textHash(now) !== origin.hash }
}

/** The built-in a vault folder replaces: by name for a component, by its origin (or id) for a template. */
export function replacedBuiltin(source: ContentSource, kind: EntryKind, folder: string): string | undefined {
  if (kind === 'component') return COMPONENT_NAME_RE.test(folder) && getBuiltinComponent(folder) ? folder : undefined
  if (!TEMPLATE_ID_RE.test(folder)) return undefined
  const origin = readOrigin(source, kind, folder)
  if (origin && builtinTemplate(origin.builtin)) return builtinTemplate(origin.builtin)!.name
  // Templates replace by name: whatever the folder is called, its frontmatter name decides.
  let name: string | undefined
  try {
    const parsed = parseVaultTemplate({ id: folder, text: readFileSync(join(folderPath(source, kind, folder), TEMPLATE_ENTRY), 'utf8') })
    name = parsed.template ? parsed.template.name : parsed.name
  } catch {
    /* no index.mdx */
  }
  return getAllTemplates(null).find((t) => t.name === name || templateFolderOf(t) === folder)?.name
}

/** Deletes a vault folder that replaces a built-in, so the built-in is used again. */
export function resetToBuiltin(source: ContentSource, kind: EntryKind, folder: string): string {
  if (source.readOnly) throw new VaultError(403, `The vault "${source.name}" is read-only`)
  const builtin = replacedBuiltin(source, kind, folder)
  if (!builtin) throw new VaultError(400, `${kind === 'component' ? COMPONENTS_DIR : TEMPLATES_DIR}/${folder} does not replace a built-in, so there is nothing to reset to`)
  const dir = folderPath(source, kind, folder)
  if (!existsSync(dir)) throw new VaultError(404, `${kind === 'component' ? COMPONENTS_DIR : TEMPLATES_DIR}/${folder} does not exist`)
  rmSync(dir, { recursive: true, force: true })
  return builtin
}
