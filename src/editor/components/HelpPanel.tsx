import { getParts, getTopLevelComponents, type RegistryProp } from '../../components/slides/defineComponent'
import { getDisplayKey, getShortcutsForMode, groupShortcutsByCategory } from '../../utils/keyboardShortcuts'

function PropList({ props }: { props: RegistryProp[] }) {
  if (props.length === 0) return null
  return (
    <ul>
      {props.map((p) => (
        <li key={p.name}>
          <code>{p.name}</code> : {p.type}
          {p.default ? ` = ${p.default}` : ''}
        </li>
      ))}
    </ul>
  )
}

/** Component reference and editor shortcuts (Part 3 §2.14). */
export function HelpPanel() {
  // Variants (names with a parenthesis) are left out; parts are shown inside their parent.
  const components = getTopLevelComponents()
    .map((c) => c.registry)
    .filter((r) => !/\(/.test(r.name))
  const groups = groupShortcutsByCategory(getShortcutsForMode('editor'))
  return (
    <aside className="help-panel">
      <h2>Component reference</h2>
      {components.map((r) => (
        <section key={r.id} className="help-panel__item">
          <h3>{[r.name, ...getParts(r.name).map((p) => p.registry.name)].join(' · ')}</h3>
          <p>{r.description}</p>
          <PropList props={r.props} />
          {getParts(r.name).map(({ registry: part }) => (
            <div key={part.id} className="help-panel__part">
              <h4>{part.name}</h4>
              <p>{part.description}</p>
              <PropList props={part.props} />
            </div>
          ))}
          <pre>{r.snippet}</pre>
        </section>
      ))}
      <h2>Keyboard shortcuts</h2>
      {[...groups].map(([category, list]) => (
        <section key={category} className="help-panel__item">
          <h3>{category}</h3>
          {list.map((s) => (
            <div key={s.action + s.keys.join()} className="shortcuts__row">
              <span>{s.action}</span>
              <span className="shortcuts__keys">
                {s.keys.map((k) => (
                  <kbd key={k}>{getDisplayKey(k)}</kbd>
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </aside>
  )
}
