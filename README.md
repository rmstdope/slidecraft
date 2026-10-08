# Slidecraft

An MDX presentation framework. Write each deck as one `index.mdx` file, compose slides from
registered React components, present with build steps, shared-element morphs and a pannable
canvas, edit in a browser editor with live preview, and export to a single HTML file or PDF.

> Status: early development. Phase 0 (bootstrap) is in place; see
> [the implementation plan](docs/plans/implementation-plan.md) for what comes next.

## Run from a checkout

Requires [Bun](https://bun.sh) 1.3 or later.

```sh
bun install
bun run dev        # http://localhost:6100
```

`bun run dev` starts the API server on port 6110 and the Vite dev server on 6100, reusing either
one if it is already running.

## Develop

```sh
bun run typecheck
bun test
bun run build
```

## Licence

Apache-2.0. See [LICENSE](LICENSE).
