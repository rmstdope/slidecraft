/**
 * Vault components, Phase V4: validate_component, conversations about a component or template
 * (target, checkpoint scope, prompt, the check after a turn, undo), the vault part of the
 * components skill and the skills Slidecraft copies into a vault.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentBackend, TurnInput } from '../server/lib/agent/backend.ts'
import { createThread, getThread, listThreads, sendMessage, setBackend, settled, undoAgentTurn } from '../server/lib/agent/threads.ts'
import { initContentSources } from '../server/lib/contentSources.ts'
import { checkVaultEntry, vaultEntryOf } from '../server/lib/componentChecks.ts'
import { executeTool } from '../server/lib/tools.ts'
import { COMPONENTS_SKILL, SKILL_NAME, syncVaultSkills, VAULT_CATALOGUE, vaultSkillDir } from '../server/lib/skillSync.ts'
import { getContentSource } from '../server/lib/contentSources.ts'
import { API_FILE, buildApiReference } from '../scripts/generateSkills.ts'

const root = mkdtempSync(join(tmpdir(), 'slidecraft-vault-agent-'))
const acme = join(root, 'acme')
afterAll(() => rmSync(root, { recursive: true, force: true }))

const ROOT = join(import.meta.dir, '..')
/** The worked example in the skill's vault part: what an agent copies must pass the check. */
const skillExample = () => /```tsx\n([\s\S]*?)```/.exec(readFileSync(join(ROOT, 'skills/slidecraft-components/references/vault.md'), 'utf8'))![1]

function write(file: string, text: string) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, text)
}

beforeAll(() => {
  write(join(acme, 'components', 'BadgeRow', 'index.tsx'), skillExample())
  write(
    join(acme, 'components', 'Sloppy', 'index.tsx'),
    `import { defineComponent } from 'slidecraft'
export const Sloppy = defineComponent({
  Component: () => <div>x</div>,
  registry: { id: 'Sloppy', name: 'Sloppy', category: 'component', description: 'no period', props: [], snippet: '<Sloppy />', previewCode: '<Slide><Sloppy /><Missing /></Slide>' },
})
`,
  )
  write(join(acme, 'templates', 'badges', 'index.mdx'), '---\nname: Badge Slide\ndescription: Three badges.\nkeywords: [badges]\n---\n<Slide>\n  <BadgeRow items={["a"]} />\n</Slide>\n')
  write(join(acme, 'talk', 'index.mdx'), '<Presentation>\n\n<Slide>\n  <Title>T</Title>\n</Slide>\n\n</Presentation>\n')
  initContentSources({ vaults: [{ id: 'acme', name: 'Acme', path: acme, components: 'trusted' }] }, undefined, join(root, 'fallback'), join(root, 'config.json'))
})

describe('validate_component', () => {
  test("the skill's worked example passes", async () => {
    const result = await checkVaultEntry('acme', 'BadgeRow')
    expect(result.problems.filter((p) => p.severity === 'error')).toEqual([])
    expect(result).toMatchObject({ ok: true, path: 'components/BadgeRow', defined: ['BadgeRow'] })
  })

  test('registry rules and the preview are checked', async () => {
    const result = await checkVaultEntry('acme', 'components/Sloppy')
    const text = result.problems.map((p) => p.message).join('\n')
    expect(result.ok).toBe(false)
    expect(text).toContain('kebab-case')
    expect(text).toContain('ending with a period')
    expect(text).toContain('previewCode: Unknown component <Missing>')
  })

  test('a folder that does not compile reports the compiler error', async () => {
    write(join(acme, 'components', 'Broken', 'index.tsx'), "import x from 'left-pad'\nexport const y = x\n")
    const result = await checkVaultEntry('acme', 'Broken')
    expect(result.ok).toBe(false)
    expect(result.problems[0].message).toContain('Does not compile')
    rmSync(join(acme, 'components', 'Broken'), { recursive: true })
  })

  test('templates are checked too, through the tool', async () => {
    const result = await executeTool('validate_component', { name: 'badges' }, { vault: 'acme' })
    expect(result).toMatchObject({ success: true, data: { ok: true, path: 'templates/badges', defined: ['Badge Slide'] } })
    expect((await executeTool('validate_component', {}, { vault: 'acme' })).success).toBe(false)
  })

  test('paths map to entries', () => {
    expect(vaultEntryOf('components/Funnel/index.tsx')).toEqual({ kind: 'component', name: 'Funnel' })
    expect(vaultEntryOf('templates/close/index.mdx')).toEqual({ kind: 'template', name: 'close' })
    expect(vaultEntryOf('talk/index.mdx')).toBeUndefined()
  })
})

/** A scripted backend: each turn runs the function the test sets. */
let script: (input: TurnInput) => Promise<{ ok: boolean }> = async () => ({ ok: true })
const seen: TurnInput[] = []
const fake: AgentBackend = {
  id: 'claude-code',
  name: 'Fake',
  detect: async () => ({ id: 'claude-code', name: 'Fake', available: true, version: 'test', approvals: true }),
  runTurn: async (input) => {
    seen.push(input)
    return script(input)
  },
}

describe('a conversation about a component', () => {
  beforeAll(() => setBackend(fake))

  test('targets the folder: prompt, list, check after the turn, and undo removes a new component', async () => {
    const thread = createThread('acme', { target: { kind: 'component', name: 'Pulse' } })
    expect(thread).toMatchObject({ target: { kind: 'component', name: 'Pulse' }, title: 'Pulse' })
    expect(listThreads('acme', undefined, { kind: 'component', name: 'Pulse' }).map((t) => t.id)).toEqual([thread.id])
    expect(listThreads('acme', undefined, { kind: 'component', name: 'Other' })).toEqual([])

    script = async () => {
      write(join(acme, 'components', 'Pulse', 'index.tsx'), skillExample().replace(/BadgeRow/g, 'Pulse').replace("'badge-row'", "'pulse'").replace('A row of', 'No period here, a row of').replace('accent colour.', 'accent colour'))
      return { ok: true }
    }
    await sendMessage('acme', thread.id, 'A pulsing badge row')
    await settled('acme', thread.id)
    const prompt = seen[seen.length - 1].prompt
    expect(prompt).toContain('Working on the vault component Pulse')
    expect(prompt).toContain('components/Pulse/')
    expect(prompt).toContain('validate_component')

    const events = getThread('acme', thread.id).events
    expect(events.find((e) => e.type === 'changes')).toMatchObject({ files: [{ path: 'components/Pulse/index.tsx', status: 'added' }] })
    const check = events.find((e) => e.type === 'deck-check')
    expect(check).toMatchObject({ path: 'components/Pulse/', ok: false })

    // The error reaches the agent with the next message.
    script = async () => ({ ok: true })
    await sendMessage('acme', thread.id, 'Fix it')
    await settled('acme', thread.id)
    expect(seen[seen.length - 1].prompt).toContain('components/Pulse/ has problems to fix')

    undoAgentTurn('acme', thread.id, 1)
    expect(existsSync(join(acme, 'components', 'Pulse'))).toBe(false)
  })

  test('a turn about a component cannot be undone outside its folder', async () => {
    const thread = createThread('acme', { target: { kind: 'template', name: 'badges' } })
    script = async () => {
      writeFileSync(join(acme, 'talk', 'index.mdx'), '<Presentation>\n\n<Slide>\n  <Title>Changed</Title>\n</Slide>\n\n</Presentation>\n')
      return { ok: true }
    }
    await sendMessage('acme', thread.id, 'Change the template')
    await settled('acme', thread.id)
    // The deck outside the folder is not in this turn's checkpoint.
    expect(getThread('acme', thread.id).events.some((e) => e.type === 'changes')).toBe(false)
  })

  test('targets are validated', () => {
    expect(() => createThread('acme', { target: { kind: 'component', name: 'lower' } as never })).not.toThrow() // parsed at the route
    expect(() => createThread('acme', { deck: { source: 'acme', path: 'talk' }, target: { kind: 'component', name: 'X' } })).toThrow('not both')
  })
})

describe('skills in a vault', () => {
  test('the components skill and a catalogue of the vault’s own are copied in', async () => {
    const result = await syncVaultSkills(getContentSource('acme')!)
    expect(result).toMatchObject({ [SKILL_NAME]: 'written', [COMPONENTS_SKILL]: 'written' })
    expect(existsSync(join(vaultSkillDir(acme, COMPONENTS_SKILL), 'references', 'vault.md'))).toBe(true)
    const catalogue = readFileSync(join(vaultSkillDir(acme), VAULT_CATALOGUE), 'utf8')
    expect(catalogue).toContain('### BadgeRow')
    expect(catalogue).toContain('### Badge Slide')
    expect(catalogue).toContain('### Sloppy')
    expect(await syncVaultSkills(getContentSource('acme')!)).toMatchObject({ [SKILL_NAME]: 'unchanged', [COMPONENTS_SKILL]: 'unchanged' })
  })

  test('the slidecraft API reference is up to date (run `bun run skills` when this fails)', async () => {
    expect(readFileSync(API_FILE, 'utf8')).toBe(await buildApiReference())
  })
})

describe('review fixes (PR #12)', () => {
  test('a macro import is refused before bundling, so it never runs', async () => {
    const marker = join(root, 'macro-ran')
    write(join(acme, 'components', 'Evil', 'm.ts'), `import { writeFileSync } from 'node:fs'\nexport function boom() { writeFileSync(${JSON.stringify(marker)}, 'x'); return 1 }\n`)
    write(join(acme, 'components', 'Evil', 'index.tsx'), "import { boom } from './m.ts' /* hidden */ with { type: 'macro' }\nexport const n = boom()\n")
    const result = await checkVaultEntry('acme', 'Evil')
    expect(result.ok).toBe(false)
    expect(result.problems[0].message).toContain('import attributes')
    expect(existsSync(marker)).toBe(false)
    rmSync(join(acme, 'components', 'Evil'), { recursive: true })
  })

  test("an untrusted vault's component is not even bundled by the check", async () => {
    const other = join(root, 'other')
    const marker = join(root, 'untrusted-ran')
    write(join(other, 'components', 'Quiet', 'index.tsx'), "export const x = 1\n")
    initContentSources(
      { vaults: [{ id: 'acme', name: 'Acme', path: acme, components: 'trusted' }, { id: 'other', name: 'Other', path: other, components: 'blocked' }] },
      undefined,
      join(root, 'fallback'),
      join(root, 'config.json'),
    )
    const result = await checkVaultEntry('other', 'Quiet')
    expect(result.ok).toBe(true)
    expect(result.problems[0].message).toContain('not compiled')
    expect(existsSync(marker)).toBe(false)
  })

  test('a component without props does not register, and the catalogue still builds', async () => {
    write(
      join(acme, 'components', 'Bare', 'index.tsx'),
      "import { defineComponent } from 'slidecraft'\nexport const Bare = defineComponent({ Component: () => null, registry: { id: 'bare', name: 'Bare', category: 'component', description: 'x.', snippet: '<Bare />', previewCode: '<Slide><Bare /></Slide>' } } as never)\n",
    )
    const result = await checkVaultEntry('acme', 'Bare')
    expect(result.problems.map((p) => p.message).join('\n')).toContain('registry needs props')
    const synced = await syncVaultSkills(getContentSource('acme')!)
    expect(synced[SKILL_NAME]).toBeDefined()
    rmSync(join(acme, 'components', 'Bare'), { recursive: true })
  })

  test('undo keeps a target folder that existed before the turn, even empty', async () => {
    mkdirSync(join(acme, 'components', 'Kept'), { recursive: true })
    const thread = createThread('acme', { target: { kind: 'component', name: 'Kept' } })
    script = async () => {
      writeFileSync(join(acme, 'components', 'Kept', 'index.tsx'), 'export const x = 1\n')
      return { ok: true }
    }
    await sendMessage('acme', thread.id, 'Write it')
    await settled('acme', thread.id)
    undoAgentTurn('acme', thread.id, 1)
    expect(existsSync(join(acme, 'components', 'Kept'))).toBe(true)
    expect(existsSync(join(acme, 'components', 'Kept', 'index.tsx'))).toBe(false)
  })
})
