/**
 * Documentation site (Part 4 §10.6): the app as a static bundle with the example decks, the
 * Markdown docs rendered to HTML, and a component catalogue generated from the registry.
 *
 *   bun run build:site [--base /slidecraft/]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { Marked, type Tokens } from 'marked'

const ROOT = join(import.meta.dir, '..')
const OUT = join(ROOT, 'site')

export interface Page {
  /** Repo-relative Markdown file, or null for generated pages. */
  file: string | null
  slug: string
  title: string
  group: 'Start' | 'Authoring' | 'Components' | 'Framework'
}

/** Sidebar order. Pages whose file does not exist yet are skipped. */
export const PAGES: Page[] = [
  { file: 'README.md', slug: 'index', title: 'Slidecraft', group: 'Start' },
  { file: 'docs/getting-started-with-agents.md', slug: 'getting-started-with-agents', title: 'Getting started with agents', group: 'Start' },
  { file: 'docs/guide.md', slug: 'guide', title: 'User guide', group: 'Start' },
  { file: 'docs/creating-presentations.md', slug: 'creating-presentations', title: 'Creating presentations', group: 'Authoring' },
  { file: 'docs/agents/presentation-author.md', slug: 'presentation-author', title: 'Presentation author guide', group: 'Authoring' },
  { file: null, slug: 'components', title: 'Component catalogue', group: 'Components' },
  { file: 'docs/agents/component-developer.md', slug: 'component-developer', title: 'Component developer guide', group: 'Components' },
  { file: 'docs/component-registry.md', slug: 'component-registry', title: 'Component registry', group: 'Components' },
  { file: 'AGENTS.md', slug: 'agents', title: 'Instructions for coding agents', group: 'Framework' },
  { file: 'docs/agents/framework-developer.md', slug: 'framework-developer', title: 'Framework developer guide', group: 'Framework' },
  { file: 'docs/agent-personas.md', slug: 'agent-personas', title: 'Agent personas', group: 'Framework' },
  { file: 'docs/slidecraft-styleguide.md', slug: 'styleguide', title: 'Style guide', group: 'Framework' },
  { file: 'docs/ROADMAP.md', slug: 'roadmap', title: 'Roadmap', group: 'Framework' },
  { file: 'docs/plans/implementation-plan.md', slug: 'implementation-plan', title: 'Implementation plan', group: 'Framework' },
]

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string; repository?: { url?: string } }
const REPO_URL = (pkg.repository?.url ?? '').replace(/\.git$/, '')

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Where a link in `fromFile` should point on the site: another site page, the gallery, or the
 * file in the repository. Absolute URLs, mail links and in-page anchors are left alone.
 */
export function resolveLink(href: string, fromFile: string, pages: Page[], repoUrl = REPO_URL): string {
  if (/^([a-z]+:|#|\/\/)/i.test(href)) return href
  const [path, hash] = href.split('#')
  const target = posix.normalize(posix.join(posix.dirname(fromFile), path))
  const page = pages.find((p) => p.file === target)
  const anchor = hash ? `#${hash}` : ''
  if (page) return page.slug === 'index' ? `./${anchor}` : `${page.slug}.html${anchor}`
  return repoUrl ? `${repoUrl}/blob/main/${target}${anchor}` : href
}

function renderMarkdown(markdown: string, fromFile: string, pages: Page[]): string {
  const marked = new Marked({ gfm: true })
  marked.use({
    renderer: {
      link(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Link) {
        const text = this.parser.parseInline(token.tokens)
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
        return `<a href="${escapeHtml(resolveLink(token.href, fromFile, pages))}"${title}>${text}</a>`
      },
    },
  })
  return marked.parse(markdown, { async: false }) as string
}

/** The catalogue: every component and template from the registry (§10.6 step 3). */
export async function catalogueHtml(galleryHref: string): Promise<string> {
  await import('../src/components/slides/index.ts')
  const { getAllComponents, getAllTemplates } = await import('../src/components/slides/defineComponent.ts')
  const components = getAllComponents().map((c) => c.registry).sort((a, b) => a.name.localeCompare(b.name))
  const templates = [...getAllTemplates()].sort((a, b) => a.name.localeCompare(b.name))
  const toc = (items: { id: string; name: string }[]) => `<ul class="toc">${items.map((i) => `<li><a href="#${i.id}">${escapeHtml(i.name)}</a></li>`).join('')}</ul>`
  const section = (r: (typeof components)[number]) => `
<section class="entry" id="${r.id}">
  <h3>${escapeHtml(r.name)} <a class="gallery-link" href="${galleryHref}">gallery</a></h3>
  <p>${escapeHtml(r.description)}</p>
  ${r.useCases?.length ? `<p class="uses"><strong>Use it for:</strong> ${r.useCases.map(escapeHtml).join('; ')}</p>` : ''}
  ${
    r.props.length
      ? `<table><thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>${r.props
          .map((p) => `<tr><td><code>${escapeHtml(p.name)}</code></td><td><code>${escapeHtml(p.type)}</code></td><td>${p.default ? `<code>${escapeHtml(p.default)}</code>` : '—'}</td><td>${escapeHtml(p.description ?? '')}</td></tr>`)
          .join('')}</tbody></table>`
      : ''
  }
  <pre><code>${escapeHtml(r.snippet)}</code></pre>
  ${r.keywords?.length ? `<p class="keywords">${r.keywords.map((k) => `<span>${escapeHtml(k)}</span>`).join('')}</p>` : ''}
</section>`
  return `<h1>Component catalogue</h1>
<p>Generated from the component registry: ${components.length} components and ${templates.length} slide templates. Every entry has a live preview in the <a href="${galleryHref}">component gallery</a>.</p>
<h2>Components</h2>${toc(components)}
<h2>Templates</h2>${toc(templates)}
<h2>Components</h2>${components.map(section).join('')}
<h2>Templates</h2>${templates.map(section).join('')}`
}

const STYLE = `
:root { --accent: #f5b400; --teal: #1f9e89; --ink: #1a1a1a; --muted: #5d5d5d; --line: #e4e1da; --bg: #fbfaf7 }
* { box-sizing: border-box }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif }
.layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100vh }
nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 28px 22px; background: #141414; color: #ddd }
nav .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; color: var(--accent); font: 600 22px Georgia, serif; text-decoration: none }
nav h4 { margin: 22px 0 6px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8c8c8c }
nav a { display: block; padding: 4px 8px; margin: 0 -8px; border-radius: 6px; color: #ddd; text-decoration: none; font-size: 14px }
nav a:hover, nav a.active { background: rgba(245,180,0,.14); color: #fff }
nav a.active { box-shadow: inset 3px 0 0 var(--accent) }
main { max-width: 900px; padding: 48px 56px 96px }
h1, h2, h3 { font-family: Georgia, serif; line-height: 1.25 }
h1 { font-size: 2.2rem; margin-top: 0 }
h2 { margin-top: 2.4rem; padding-bottom: .3rem; border-bottom: 1px solid var(--line) }
a { color: #0f6f61 }
code { font: .88em ui-monospace, Menlo, monospace; background: #efece6; padding: .1em .35em; border-radius: 4px }
pre { overflow-x: auto; padding: 14px 16px; border-radius: 8px; background: #1c1c1c; color: #f2f2f2 }
pre code { background: none; padding: 0; color: inherit }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92rem }
th, td { text-align: left; vertical-align: top; padding: 6px 10px; border-bottom: 1px solid var(--line) }
th { font-size: .78rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted) }
blockquote { margin: 1rem 0; padding: .4rem 1rem; border-left: 4px solid var(--accent); background: #f4f1ea }
.toc { columns: 3; padding-left: 1.1rem; font-size: .92rem }
.entry { padding: 1.2rem 0; border-bottom: 1px solid var(--line) }
.entry h3 { margin: 0 0 .4rem; display: flex; align-items: baseline; gap: .8rem }
.gallery-link { font: 600 .72rem system-ui; letter-spacing: .08em; text-transform: uppercase; text-decoration: none; color: var(--teal) }
.keywords span { display: inline-block; margin: 0 .35rem .35rem 0; padding: .05rem .5rem; border-radius: 999px; background: #efece6; font-size: .78rem; color: var(--muted) }
.uses { color: var(--muted) }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr } nav { position: static; height: auto } main { padding: 28px 20px 64px } .toc { columns: 1 } }
`

function shell(page: Page, body: string, pages: Page[], base: string): string {
  const groups = ['Start', 'Authoring', 'Components', 'Framework'] as const
  const href = (p: Page) => (p.slug === 'index' ? './' : `${p.slug}.html`)
  const nav = groups
    .map((g) => {
      const items = pages.filter((p) => p.group === g)
      return items.length ? `<h4>${g}</h4>${items.map((p) => `<a href="${href(p)}"${p.slug === page.slug ? ' class="active"' : ''}>${escapeHtml(p.title)}</a>`).join('')}` : ''
    })
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}${page.slug === 'index' ? '' : ' · Slidecraft'}</title>
<link rel="icon" type="image/svg+xml" href="${base}app/favicon.svg">
<style>${STYLE}</style>
</head>
<body>
<div class="layout">
<nav>
<a class="brand" href="./"><img src="${base}app/logo-on-dark.svg" alt="" width="26" height="26">Slidecraft</a>
${nav}
<h4>Live</h4><a href="${base}app/">Example decks</a><a href="${base}app/gallery">Component gallery</a>
</nav>
<main>${body}</main>
</div>
</body>
</html>
`
}

async function run(cmd: string[], env: Record<string, string>) {
  const proc = Bun.spawn(cmd, { cwd: ROOT, env: { ...process.env, ...env }, stdout: 'inherit', stderr: 'inherit' })
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(' ')} failed`)
}

async function main() {
  const argBase = process.argv[process.argv.indexOf('--base') + 1]
  let base = process.argv.includes('--base') && argBase ? argBase : '/'
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`

  rmSync(OUT, { recursive: true, force: true })
  // 1. The app with the example decks bundled, static mode (no editor, chat, export or live reload).
  await run(['bunx', 'vite', 'build', '--outDir', 'site/app', '--emptyOutDir'], { SLIDECRAFT_BUNDLE_CONTENT: '1', VITE_STATIC: '1', VITE_BASE: `${base}app/` })
  cpSync(join(OUT, 'app', 'index.html'), join(OUT, '404.html')) // deep links on static hosting

  // 2–3. Markdown pages and the catalogue.
  const pages = PAGES.filter((p) => p.file === null || existsSync(join(ROOT, p.file)))
  for (const page of pages) {
    const body = page.file ? renderMarkdown(readFileSync(join(ROOT, page.file), 'utf8'), page.file, pages) : await catalogueHtml(`${base}app/gallery`)
    const out = join(OUT, `${page.slug}.html`)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, shell(page, body, pages, base))
  }
  writeFileSync(join(OUT, '.nojekyll'), '')
  console.log(`Site written to site/ (${pages.length} pages, base ${base})`)
}

if (import.meta.main) await main()
