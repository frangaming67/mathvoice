import { useEffect, useRef, useState } from 'react';
import { commands, normalizeSearch, type MathCommand } from '../keyboard/commands';
import { shortcutFor, type KeyboardSettings } from '../keyboard/KeyboardSettings';
import { usePreserveReaderKeys } from '../keyboard/CommandContext';

export function CommandPalette({
  settings,
  execute,
  close,
  announce,
}: {
  settings: KeyboardSettings;
  execute: (command: MathCommand) => void;
  close: () => void;
  announce: (text: string, speak?: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preservesReaderKeys = usePreserveReaderKeys();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const results = commands.filter(
    (command) =>
      !['palette', 'stop'].includes(command.id) &&
      normalizeSearch(`${command.name} ${command.category} ${command.description}`).includes(
        normalizeSearch(query),
      ),
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        announce(`${results.length} resultados. Usá las flechas y Enter para abrir una función.`),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, results.length, announce]);
  function choose(command: MathCommand) {
    dialog.current?.close();
    execute(command);
  }
  return (
    <dialog ref={dialog} aria-labelledby="palette-title" onCancel={close}>
      <h2 id="palette-title">Paleta de comandos</h2>
      <p id="palette-help">
        Escribí parte del nombre. Flechas arriba y abajo recorren resultados. Enter abre la función.
        Escape cancela.
      </p>
      <label>
        Buscar comando
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[selected] ? `palette-${results[selected].id}` : undefined}
          aria-describedby="palette-help"
          onKeyDown={(event) => {
            if (
              preservesReaderKeys(event.nativeEvent) ||
              event.ctrlKey ||
              event.altKey ||
              event.metaKey ||
              event.shiftKey
            )
              return;
            if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              const next = Math.max(
                0,
                Math.min(results.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1)),
              );
              setSelected(next);
              if (results[next])
                announce(
                  `${results[next].name}. ${shortcutFor(results[next], settings) || 'Sin tecla asignada'}.`,
                );
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (results[selected]) choose(results[selected]);
            }
          }}
        />
      </label>
      <p>{results.length} resultados.</p>
      <ul
        id="palette-results"
        role="listbox"
        aria-label="Comandos encontrados"
        className="command-results"
      >
        {results.map((command, index) => (
          <li
            key={command.id}
            id={`palette-${command.id}`}
            role="option"
            aria-selected={selected === index}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(command)}
          >
            {command.name} · {command.category} ·{' '}
            {shortcutFor(command, settings) || 'Sin tecla asignada'}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!results.length}
        onClick={() => results[selected] && choose(results[selected])}
      >
        Abrir función seleccionada
      </button>
      <button type="button" onClick={close}>
        Cancelar paleta
      </button>
    </dialog>
  );
}
