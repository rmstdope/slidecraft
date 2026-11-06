import { useRegistryVersion } from '../../hooks/useRegistryVersion'
import { getParts, getTopLevelComponents, type RegistryProp } from '../../components/slides/defineComponent'
import { getDisplayKey, getShortcutsForMode, groupShortcutsByCategory } from '../../utils/keyboardShortcuts'
import { Kbd } from '../../ui'

function PropList({ props }: { props: RegistryProp[] }) {
  if (props.length === 0) return null
  return (
    <ul className="tw:flex tw:flex-col tw:gap-0.5 tw:text-[12px] tw:text-fg-2">
      {props.map((p) => (
        <li key={p.name}>
          <code className="tw:font-mono tw:text-fg">{p.name}</code> : {p.type}
          {p.default ? ` = ${p.default}` : ''}
        </li>
      ))}
    </ul>
  )
}

/** Component reference and editor shortcuts (Part 3 §2.14). */
export function HelpPanel() {
  useRegistryVersion()
  // Variants (names with a parenthesis) are left out; parts are shown inside their parent.
  const components = getTopLevelComponents()
    .map((c) => c.registry)
    .filter((r) => !/\(/.test(r.name))
  const groups = groupShortcutsByCategory(getShortcutsForMode('editor'))
  return (
    <aside aria-label="Help" className="tw:flex tw:h-full tw:w-80 tw:shrink-0 tw:flex-col tw:gap-3 tw:overflow-y-auto tw:rounded-[14px] tw:bg-panel tw:p-4 tw:shadow-hairline">
      <h2 className="tw:font-display tw:text-[18px] tw:font-semibold">Component reference</h2>
      {components.map((r) => (
        <section key={r.id} className="tw:flex tw:flex-col tw:gap-1.5 tw:border-t tw:border-line tw:pt-3">
          <h3 className="tw:font-semibold">{[r.name, ...getParts(r.name).map((p) => p.registry.name)].join(' · ')}</h3>
          <p className="tw:text-[13px] tw:text-muted">{r.description}</p>
          <PropList props={r.props} />
          {getParts(r.name).map(({ registry: part }) => (
            <div key={part.id} className="tw:flex tw:flex-col tw:gap-1 tw:border-l-2 tw:border-line tw:pl-2.5">
              <h4 className="tw:text-[13px] tw:font-semibold">{part.name}</h4>
              <p className="tw:text-[12px] tw:text-muted">{part.description}</p>
              <PropList props={part.props} />
            </div>
          ))}
          <pre className="tw:m-0 tw:overflow-x-auto tw:rounded-lg tw:bg-field tw:p-2.5 tw:font-mono tw:text-[11.5px] tw:text-fg-2">{r.snippet}</pre>
        </section>
      ))}
      <h2 className="tw:mt-2 tw:font-display tw:text-[18px] tw:font-semibold">Keyboard shortcuts</h2>
      {[...groups].map(([category, list]) => (
        <section key={category} className="tw:flex tw:flex-col tw:gap-1 tw:border-t tw:border-line tw:pt-3">
          <h3 className="tw:font-semibold">{category}</h3>
          {list.map((s) => (
            <div key={s.action + s.keys.join()} className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-[13px] tw:text-fg-2">
              <span>{s.action}</span>
              <span className="tw:flex tw:gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{getDisplayKey(k)}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </aside>
  )
}
