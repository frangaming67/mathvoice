import { useEffect, useRef, useState } from 'react';
import { categories, commands, normalizeSearch, type MathCommand } from '../keyboard/commands';
import {
  assignmentError,
  defaultKeyboardSettings,
  enabledCommands,
  normalizeShortcut,
  parseKeyboardSettings,
  reservedReason,
  shortcutFor,
  type KeyboardSettings,
} from '../keyboard/KeyboardSettings';
import { eventShortcut } from '../keyboard/KeyboardCommandManager';
import { speech } from '../services/SpeechService';
import { usePreserveReaderKeys } from '../keyboard/CommandContext';

export function KeyboardPanel({
  settings,
  change,
  execute,
  practice,
  announce,
  read,
  cancelAutomatic,
}: {
  settings: KeyboardSettings;
  change: (settings: KeyboardSettings) => void;
  execute: (command: MathCommand) => void;
  practice: (mode: 'identify' | 'training', category: string) => void;
  announce: (message: string, speak?: boolean) => void;
  read: (message: string) => void;
  cancelAutomatic: () => void;
}) {
  const [query, setQuery] = useState(''),
    [keyQuery, setKeyQuery] = useState(''),
    [category, setCategory] = useState('');
  const [editing, setEditing] = useState<MathCommand | null>(null),
    [candidate, setCandidate] = useState(''),
    [error, setError] = useState('');
  const [readingIndex, setReadingIndex] = useState(0);
  useEffect(() => () => speech.detener(), []);
  const remap = useRef<HTMLDialogElement>(null),
    restore = useRef<HTMLDialogElement>(null);
  const preservesReaderKeys = usePreserveReaderKeys();
  const enabled = new Set(enabledCommands(settings).map((command) => command.id));
  const results = commands.filter(
    (command) =>
      (!category || command.category === category) &&
      normalizeSearch(`${command.name} ${command.description}`).includes(normalizeSearch(query)) &&
      normalizeSearch(shortcutFor(command, settings)).includes(normalizeSearch(keyQuery)),
  );
  useEffect(() => {
    const timer = setTimeout(
      () => announce(`${results.length} funciones en la referencia de teclado.`, false),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, keyQuery, category, results.length, announce]);
  const description = (command: MathCommand) =>
    `${command.name}. ${shortcutFor(command, settings) || 'Sin atajo'}. ${command.global ? 'Disponible en la aplicación' : `Modo matemático. Contexto: ${command.category}`}. ${command.description}`;
  function readOne(index: number) {
    const next = Math.max(0, Math.min(results.length - 1, index));
    setReadingIndex(next);
    if (results[next]) read(description(results[next]));
  }
  return (
    <section className="panel keyboard-reference" aria-labelledby="keyboard-title">
      <h2 id="keyboard-title" tabIndex={-1}>
        Teclado y atajos
      </h2>
      <p>
        Modo actual: {settings.mode === 'math' ? 'teclado matemático' : 'escritura'}. F2 cambia de
        modo. Las letras matemáticas actúan en el área de trabajo, fuera de los campos de edición.
      </p>
      <p>
        Con un lector de pantalla, usá sus controles para pasar las teclas a la página cuando
        quieras practicar o usar comandos matemáticos. La navegación rápida del lector puede usar
        letras, números, símbolos y flechas. También podés usar la paleta y los formularios con Tab.
        MathVoice respeta los modificadores de tu lector.
      </p>
      <div className="actions">
        <button
          onClick={() =>
            change({ ...settings, mode: settings.mode === 'math' ? 'writing' : 'math' })
          }
        >
          {settings.mode === 'math' ? 'Activar modo escritura' : 'Activar modo matemático'}
        </button>
        <button onClick={() => practice('identify', category)}>Identificar tecla</button>
        <button onClick={() => practice('training', category)}>Practicar teclado</button>
      </div>
      <fieldset>
        <legend>Preferencias de teclado</legend>
        <label>
          Perfil de teclado
          <select
            value={settings.profile}
            onChange={(event) => {
              change({ ...settings, profile: event.target.value as KeyboardSettings['profile'] });
              announce('Perfil de teclado cambiado.');
            }}
          >
            <option value="simple">Simplificado</option>
            <option value="standard">Estándar</option>
            <option value="advanced">Avanzado</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label>
          Nivel de mensajes
          <select
            value={settings.verbosity}
            onChange={(event) =>
              change({
                ...settings,
                verbosity: event.target.value as KeyboardSettings['verbosity'],
              })
            }
          >
            <option value="minimal">Mínimo: errores y resultados</option>
            <option value="normal">Normal: acciones importantes</option>
            <option value="detailed">Detallado: cada comando</option>
            <option value="training">Entrenamiento: explicar cada comando</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.sounds}
            onChange={(event) => change({ ...settings, sounds: event.target.checked })}
          />
          Sonidos breves de confirmación
        </label>
      </fieldset>
      <h3>Buscar y escuchar funciones</h3>
      <label>
        Buscar función
        <input
          value={query}
          onChange={(event) => {
            speech.detener();
            setQuery(event.target.value);
            setReadingIndex(0);
          }}
        />
      </label>
      <label>
        Buscar tecla
        <input
          placeholder="Ejemplo: Shift+D"
          value={keyQuery}
          onChange={(event) => {
            speech.detener();
            setKeyQuery(event.target.value);
            setReadingIndex(0);
          }}
        />
      </label>
      <label>
        Categoría de atajos
        <select
          value={category}
          onChange={(event) => {
            speech.detener();
            setCategory(event.target.value);
            setReadingIndex(0);
          }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <p>
        {results.length} funciones encontradas. Los perfiles limitan los atajos activos; la paleta
        siempre permite abrir todas las funciones disponibles.
      </p>
      <div className="actions" data-preserve-reading>
        <button
          disabled={!results.length}
          onClick={() => {
            setReadingIndex(0);
            cancelAutomatic();
            speech.hablarLista(results.map(description), setReadingIndex);
          }}
        >
          Escuchar atajos
        </button>
        <button
          onClick={() => {
            cancelAutomatic();
            speech.pausar();
          }}
        >
          Pausar lectura de atajos
        </button>
        <button
          onClick={() => {
            cancelAutomatic();
            speech.continuar();
          }}
        >
          Continuar lectura de atajos
        </button>
        <button disabled={!results.length} onClick={() => readOne(readingIndex - 1)}>
          Atajo anterior
        </button>
        <button disabled={!results.length} onClick={() => readOne(readingIndex + 1)}>
          Atajo siguiente
        </button>
        <button
          onClick={() => {
            cancelAutomatic();
            speech.detener();
          }}
        >
          Detener lectura de atajos
        </button>
      </div>
      <h3>Funciones favoritas</h3>
      <ul>
        {settings.favorites.map((id) => {
          const command = commands.find((c) => c.id === id)!;
          return (
            <li key={id}>
              <button onClick={() => execute(command)}>{command.name}</button>
            </li>
          );
        })}
      </ul>
      {!settings.favorites.length && (
        <p>Abrí una función de la referencia y elegí Agregar a favoritos.</p>
      )}
      {categories
        .filter((name) => results.some((command) => command.category === name))
        .map((name) => (
          <section key={name} aria-label={name}>
            <h3>{name}</h3>
            {results
              .filter((command) => command.category === name)
              .map((command) => (
                <details key={command.id}>
                  <summary>
                    {command.name} · {shortcutFor(command, settings) || 'Sin atajo'}
                  </summary>
                  <p>{description(command)}</p>
                  <p>
                    {enabled.has(command.id)
                      ? 'Atajo habilitado en este perfil.'
                      : 'Atajo desactivado en este perfil; podés abrir la función con su botón o agregarla a favoritos.'}
                  </p>
                  <div className="actions">
                    <button onClick={() => execute(command)}>Abrir {command.name}</button>
                    <button onClick={() => read(description(command))}>
                      Escuchar {command.name}
                    </button>
                    <button
                      aria-pressed={settings.favorites.includes(command.id)}
                      onClick={() => {
                        change({
                          ...settings,
                          favorites: settings.favorites.includes(command.id)
                            ? settings.favorites.filter((id) => id !== command.id)
                            : [...settings.favorites, command.id],
                        });
                        announce('Favoritos actualizados.');
                      }}
                    >
                      {settings.favorites.includes(command.id)
                        ? 'Quitar de favoritos'
                        : 'Agregar a favoritos'}
                      : {command.name}
                    </button>
                    {command.customizable && (
                      <button
                        onClick={() => {
                          setEditing(command);
                          setCandidate(shortcutFor(command, settings));
                          setError('');
                          remap.current?.showModal();
                        }}
                      >
                        Cambiar atajo de {command.name}
                      </button>
                    )}
                  </div>
                </details>
              ))}
          </section>
        ))}
      <h3>Guardar, importar y restaurar</h3>
      <p>
        Las preferencias se guardan en este dispositivo. La importación se valida completa antes de
        aplicarse. Una tecla en conflicto nunca se reemplaza silenciosamente.
      </p>
      <button
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }),
          );
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'mathvoice-teclado.json';
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          announce('Se solicitó la descarga de la configuración de teclado.');
        }}
      >
        Exportar atajos JSON
      </button>
      <label>
        Importar atajos JSON
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              if (file.size > 100000) throw new Error('El archivo supera 100 kilobytes.');
              const imported = parseKeyboardSettings(JSON.parse(await file.text()));
              change(imported);
              announce('Configuración de teclado importada.');
            } catch (cause) {
              announce(`No se importó el archivo. ${(cause as Error).message}`);
            }
          }}
        />
      </label>
      <button onClick={() => restore.current?.showModal()}>Restaurar atajos predeterminados</button>
      <dialog ref={restore} aria-labelledby="restore-keyboard-title">
        <h2 id="restore-keyboard-title">Restaurar teclado</h2>
        <p>
          Se restablecerán perfil, modo, favoritos y asignaciones. Las expresiones y el historial se
          conservan.
        </p>
        <button
          onClick={() => {
            change({ ...defaultKeyboardSettings, overrides: {}, favorites: [] });
            restore.current?.close();
            announce('Atajos restaurados. Modo escritura activado.');
          }}
        >
          Confirmar restauración
        </button>
        <button onClick={() => restore.current?.close()}>Cancelar restauración</button>
      </dialog>
      <dialog ref={remap} aria-labelledby="remap-title">
        <h2 id="remap-title">Cambiar atajo: {editing?.name}</h2>
        <p>
          Capturá una combinación en el botón o escribí una secuencia como G D. Una asignación vacía
          desactiva ese atajo. F1, F2 y Escape se conservan. Las teclas reservadas del navegador y
          del lector de pantalla no pueden asignarse. Para símbolos, escribí el carácter sin Shift.
        </p>
        <button
          type="button"
          onKeyDown={(event) => {
            if (
              preservesReaderKeys(event.nativeEvent) ||
              event.repeat ||
              event.nativeEvent.getModifierState('AltGraph')
            )
              return;
            if (['Tab', 'Escape', 'Enter', ' '].includes(event.key)) return;
            const shortcut = eventShortcut(event.nativeEvent);
            if (!shortcut) return;
            const reason = reservedReason(shortcut);
            if (reason) {
              setError(reason);
              return;
            }
            event.preventDefault();
            setCandidate(shortcut);
            setError('');
            announce(`Combinación capturada: ${shortcut}.`);
          }}
        >
          Presioná aquí la nueva combinación
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!editing) return;
            const reason = assignmentError(editing.id, candidate, settings);
            if (reason) {
              setError(reason);
              announce(reason);
              return;
            }
            change({
              ...settings,
              profile: 'custom',
              overrides: {
                ...settings.overrides,
                [editing.id]: candidate ? normalizeShortcut(candidate) : '',
              },
            });
            remap.current?.close();
            announce(`Atajo de ${editing.name} guardado.`);
          }}
        >
          <label>
            Nueva combinación
            <input
              value={candidate}
              maxLength={60}
              onChange={(event) => {
                setCandidate(event.target.value);
                setError('');
              }}
              aria-describedby={error ? 'shortcut-error' : undefined}
              aria-invalid={!!error}
            />
          </label>
          {error && (
            <p id="shortcut-error" className="error">
              {error}
            </p>
          )}
          <button>Guardar atajo</button>
          <button type="button" onClick={() => remap.current?.close()}>
            Cancelar cambio de atajo
          </button>
        </form>
      </dialog>
    </section>
  );
}
