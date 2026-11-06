/**
 * `validate_component` and the check after every agent turn (vault components plan, V4): what an
 * agent must fix before a vault component or template is done. A component is compiled with the
 * import rule, loaded into the server's registry (only when the vault's components may run),
 * held to the folder rule and the registry rules, and its `snippet` and `previewCode` are checked
 * like a deck in the vault's scope. A template is parsed and its slide checked the same way.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DeckProblem } from '../../shared/agent.ts'
import { COMPONENT_ENTRY, COMPONENT_NAME_RE, COMPONENTS_DIR } from '../../shared/vaultComponents.ts'
import { TEMPLATE_ENTRY, TEMPLATE_ID_RE, TEMPLATES_DIR } from '../../shared/vaultTemplates.ts'
import { getAllComponents, getAllTemplates, getSourceProblems, sourceOfEntry, type RegistryConfig } from '../../src/components/slides/defineComponent.ts'
import { getComponentTrust, getContentSource } from './contentSources.ts'
import { checkDeck } from './deckChecks.ts'
import { ensureServerComponents } from './serverRegistry.ts'
import { bundleComponent } from './vaultComponents.ts'

export interface ComponentCheck {
  ok: boolean
  /** `components/<Name>` or `templates/<id>`. */
  path: string
  problems: DeckProblem[]
  /** What was defined: the component and its parts, or the template. */
  defined: string[]
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/
const error = (message: string, line?: number): DeckProblem => ({ severity: 'error', message, ...(line ? { line } : {}) })
const warning = (message: string): DeckProblem => ({ severity: 'warning', message })

function done(path: string, problems: DeckProblem[], defined: string[] = []): ComponentCheck {
  return { ok: !problems.some((p) => p.severity === 'error'), path, problems, defined }
}

/** The registry rules every entry follows (docs/component-registry.md). */
function registryProblems(r: RegistryConfig): DeckProblem[] {
  const out: DeckProblem[] = []
  const who = r.name
  if (!KEBAB.test(r.id)) out.push(error(`${who}: id "${r.id}" must be kebab-case, such as "funnel-bars"`))
  if (!r.description?.trim().endsWith('.')) out.push(error(`${who}: description must be one sentence ending with a period`))
  if (!Array.isArray(r.props)) out.push(error(`${who}: props must be a list`))
  else for (const p of r.props) if (!p?.name || !p?.type) out.push(error(`${who}: every prop needs a name and a type`))
  if (!r.snippet?.trim().startsWith('<')) out.push(error(`${who}: snippet must be MDX, such as <${who} />`))
  if (r.category === 'component' && !r.parent && !/<Slide[\s>]/.test(r.previewCode ?? '')) out.push(error(`${who}: previewCode must be a <Slide> using the component`))
  if (!r.keywords?.length) out.push(warning(`${who}: keywords help the palette and gallery search find it`))
  return out
}

/** A snippet or preview checked as a deck in the vault's scope; problems keep only the message. */
async function mdxProblems(label: string, mdx: string, vault: string): Promise<DeckProblem[]> {
  const body = /<Presentation[\s>]/.test(mdx) ? mdx : `<Presentation>\n\n${/<Slide[\s>]/.test(mdx) ? mdx : `<Slide>\n${mdx}\n</Slide>`}\n\n</Presentation>\n`
  const result = await checkDeck(body, vault)
  return result.problems.map((p) => ({ severity: p.severity, message: `${label}: ${p.message}` }))
}

export async function checkVaultComponent(vaultId: string, name: string): Promise<ComponentCheck> {
  const path = `${COMPONENTS_DIR}/${name}`
  const source = getContentSource(vaultId)
  if (!source) return done(path, [error(`No vault "${vaultId}"`)])
  if (!COMPONENT_NAME_RE.test(name)) return done(path, [error(`"${name}" is not a component name: use PascalCase, such as FunnelBars`)])
  if (!existsSync(join(source.path, COMPONENTS_DIR, name, COMPONENT_ENTRY))) return done(path, [error(`${path}/${COMPONENT_ENTRY} does not exist`)])

  const bundle = await bundleComponent(source, name)
  if (bundle.error !== undefined) {
    return done(
      path,
      bundle.error.split('\n').map((line) => {
        const at = /^[^:]+:(\d+): /.exec(line)
        return error(`Does not compile: ${line}`, at ? Number(at[1]) : undefined)
      }),
    )
  }
  if (getComponentTrust(source) !== 'trusted') {
    return done(path, [warning("It compiles, but the vault's components are not allowed to run, so it was not loaded or checked further (Settings › Vaults)")])
  }

  await ensureServerComponents(vaultId)
  const problems: DeckProblem[] = []
  const failed = getSourceProblems(vaultId).find((p) => p.name === name && !p.template)
  if (failed) return done(path, failed.message.split('\n').map((m) => error(m)))

  const own = getAllComponents(vaultId).filter((c) => sourceOfEntry(c.registry) === vaultId && (c.registry.name === name || c.registry.parent === name))
  const all = getAllComponents(vaultId)
  for (const { registry } of own) {
    problems.push(...registryProblems(registry))
    const clash = all.find((c) => c.registry.id === registry.id && c.registry.name !== registry.name)
    if (clash) problems.push(error(`${registry.name}: id "${registry.id}" is already ${clash.registry.name}'s; choose another`))
  }
  const main = own.find((c) => c.registry.name === name)?.registry
  if (main) {
    problems.push(...(await mdxProblems('snippet', main.snippet, vaultId)))
    problems.push(...(await mdxProblems('previewCode', main.previewCode, vaultId)))
  }
  return done(path, problems, own.map((c) => c.registry.name))
}

export async function checkVaultTemplate(vaultId: string, id: string): Promise<ComponentCheck> {
  const path = `${TEMPLATES_DIR}/${id}`
  const source = getContentSource(vaultId)
  if (!source) return done(path, [error(`No vault "${vaultId}"`)])
  if (!TEMPLATE_ID_RE.test(id)) return done(path, [error(`"${id}" is not a template folder name: use lower-case words joined by dashes`)])
  if (!existsSync(join(source.path, TEMPLATES_DIR, id, TEMPLATE_ENTRY))) return done(path, [error(`${path}/${TEMPLATE_ENTRY} does not exist`)])
  await ensureServerComponents(vaultId)
  const failed = getSourceProblems(vaultId).find((p) => p.template && p.folder === id)
  if (failed) return done(path, failed.message.split('\n').map((m) => error(m)))
  const template = getAllTemplates(vaultId).find((t) => t.id === `template-${id}` && sourceOfEntry(t) === vaultId)
  if (!template) return done(path, [error(`${path} is not registered; check its frontmatter`)])
  const problems = [...registryProblems(template), ...(await mdxProblems('slide', template.previewCode, vaultId))]
  return done(path, problems, [template.name])
}

/** `components/<Name>/…` or `templates/<id>/…` (a path a turn changed, or a tool argument). */
export function vaultEntryOf(path: string): { kind: 'component' | 'template'; name: string } | undefined {
  const match = /^(components|templates)\/([^/]+)(?:\/|$)/.exec(path.replace(/^\.\//, ''))
  if (!match) return undefined
  return { kind: match[1] === COMPONENTS_DIR ? 'component' : 'template', name: match[2] }
}

/** Check whichever a name or path refers to: a component folder, else a template folder. */
export async function checkVaultEntry(vaultId: string, nameOrPath: string): Promise<ComponentCheck> {
  const entry = vaultEntryOf(nameOrPath)
  if (entry) return entry.kind === 'component' ? checkVaultComponent(vaultId, entry.name) : checkVaultTemplate(vaultId, entry.name)
  const source = getContentSource(vaultId)
  if (source && TEMPLATE_ID_RE.test(nameOrPath) && existsSync(join(source.path, TEMPLATES_DIR, nameOrPath))) return checkVaultTemplate(vaultId, nameOrPath)
  return checkVaultComponent(vaultId, nameOrPath)
}
