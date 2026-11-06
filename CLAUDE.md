@AGENTS.md

The implementation plan, with the decisions already taken, is `docs/plans/implementation-plan.md`.
The UX overhaul (vaults, streaming CLI agents, skills) is `docs/plans/ux-overhaul-plan.md`; it
overrides the implementation plan where they disagree.
The UI redesign (Tailwind and Radix chrome, light and dark themes) is `docs/plans/ui-redesign-plan.md`;
it overrides `docs/slidecraft-styleguide.md` where they disagree.
Vault components and templates (per-vault `components/` and `templates/` that add to or override
the built-ins, edited by the agent from the gallery) are `docs/plans/vault-components-plan.md`.
Do not re-open those decisions unless the user asks. The spec it implements is `../presentation-tool.md`
(about 5,150 lines; read the outline with `grep -n '^#'` and then sections by line range).
