import { useState, type KeyboardEvent } from 'react';
import { toolGroups, type ToolId } from './toolCatalog';

const order: ToolId[] = toolGroups.flatMap((group) => group.tools.map(([id]) => id));

/**
 * Lista de herramientas con una sola parada de Tab: flechas, Inicio y Fin mueven el foco
 * entre herramientas y Enter o Espacio abren la elegida.
 */
export function ToolsPage({ current, open }: { current: ToolId; open: (tool: ToolId) => void }) {
  const [focused, setFocused] = useState<ToolId>(current);
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const index = order.indexOf(focused);
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? order[Math.min(order.length - 1, index + 1)]
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? order[Math.max(0, index - 1)]
          : event.key === 'Home'
            ? order[0]
            : event.key === 'End'
              ? order.at(-1)
              : undefined;
    if (!next) return;
    event.preventDefault();
    setFocused(next);
    document.getElementById(`tool-item-${next}`)?.focus();
  }
  return (
    <div className="tools-page" onKeyDown={move}>
      <p className="intro" id="tools-help">
        Elegí una herramienta con las flechas y abrila con Enter. Tus datos se conservan al cambiar.
      </p>
      {toolGroups.map((group, index) => (
        <section key={group.label} aria-labelledby={`tools-group-${index}`}>
          <h2 id={`tools-group-${index}`}>{group.label}</h2>
          <ul className="tool-list">
            {group.tools.map(([id, label, description]) => (
              <li key={id}>
                <button
                  id={`tool-item-${id}`}
                  type="button"
                  className="tool-item"
                  tabIndex={id === focused ? 0 : -1}
                  aria-describedby={`tool-item-${id}-description`}
                  aria-current={id === current ? 'true' : undefined}
                  onFocus={() => setFocused(id)}
                  onClick={() => open(id)}
                >
                  {label}
                </button>
                <p id={`tool-item-${id}-description`} className="hint">
                  {description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
