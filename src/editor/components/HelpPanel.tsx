import { getAllComponents } from '../../components/slides/defineComponent'
import { getDisplayKey, getShortcutsForMode, groupShortcutsByCategory } from '../../utils/keyboardShortcuts'

/** Component reference and editor shortcuts (Part 3 §2.14). */
export function HelpPanel() {
  const components = getAllComponents()
    .map((c) => c.registry)
    .filter((r) => !/\(/.test(r.name) && r.name !== 'ListItem')
  const groups = groupShortcutsByCategory(getShortcutsForMode('editor'))
  return (
    <aside className="help-panel">
      <h2>Component reference</h2>
      {components.map((r) => (
        <section key={r.id} className="help-panel__item">
          <h3>{r.name === 'List' ? 'List / ListItem' : r.name}</h3>
          <p>{r.description}</p>
          {r.props.length > 0 && (
            <ul>
              {r.props.map((p) => (
                <li key={p.name}>
                  <code>{p.name}</code> : {p.type}
                  {p.default ? ` = ${p.default}` : ''}
                </li>
              ))}
            </ul>
          )}
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
