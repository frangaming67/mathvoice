import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { HistoryEntry, ScreenReaderMath } from '../types';
import { downloadHistory, type ExportFormat } from '../services/ExportService';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
import { resultSpeech, type ResultSpeechOptions } from '../accessibility/resultSpeech';
import {
  HISTORY_PAGE,
  historyEntryLabel,
  historyEntrySpeech,
  historyKeyAction,
  historyNeighbor,
} from '../services/HistoryService';
import { CalculationSteps } from './CalculationSteps';
import { MathView } from './MathView';

const angleNames = { rad: 'Radianes', deg: 'Grados', grad: 'Gradianes' } as const;
const exports: [ExportFormat, string][] = [
  ['html', 'Exportar informe para imprimir (HTML)'],
  ['txt', 'Exportar TXT'],
  ['csv', 'Exportar CSV'],
  ['json', 'Exportar JSON'],
];
const entryId = (id: string) => `history-entry-${id}`;

/**
 * Historial con una sola parada de Tab: las flechas recorren los cálculos y cada uno se nombra
 * en palabras. Los botones de cada entrada siguen a mano para el ratón y el modo exploración.
 */
export function History({
  entries,
  speechOptions,
  srMath,
  edit,
  recalculate,
  remove,
  clear,
  speak,
  copy,
}: {
  entries: HistoryEntry[];
  speechOptions: ResultSpeechOptions;
  srMath: ScreenReaderMath;
  edit: (e: HistoryEntry) => void;
  recalculate: (e: HistoryEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
  speak: (text: string) => void;
  copy: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [shown, setShown] = useState(HISTORY_PAGE);
  const [current, setCurrent] = useState<string | null>(null);
  const clearButton = useRef<HTMLButtonElement>(null);
  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase();
    return words
      ? entries.filter((e) => `${e.expression} ${e.value}`.toLowerCase().includes(words))
      : entries;
  }, [entries, query]);
  const visible = useMemo(() => filtered.slice(0, shown), [filtered, shown]);
  // Lo hablado de cada entrada se calcula una vez por lista, no en cada tecla de la calculadora.
  const spoken = useMemo(
    () =>
      new Map(
        visible.map((e) => {
          const options = { ...speechOptions, decimalSeparator: e.separator ?? 'punto' };
          return [
            e.id,
            {
              label: historyEntryLabel(e, speechOptions),
              expression: mathSpeech(e.expression, options),
              result: resultSpeech(e, options),
            },
          ];
        }),
      ),
    [visible, speechOptions],
  );
  const focusId = visible.some((e) => e.id === current) ? current : (visible[0]?.id ?? null);
  function focusEntry(id: string) {
    setCurrent(id);
    // En el acto si ya está en la página: la tecla siguiente tiene que actuar sobre esta entrada.
    const element = document.getElementById(entryId(id));
    if (element) element.focus();
    else requestAnimationFrame(() => document.getElementById(entryId(id))?.focus());
  }
  function removeEntry(entry: HistoryEntry) {
    const neighbor = historyNeighbor(visible, entry.id);
    remove(entry.id);
    if (neighbor) focusEntry(neighbor);
    else requestAnimationFrame(() => document.getElementById('history-title')?.focus());
  }
  function showMore() {
    const next = filtered[shown];
    setShown(shown + HISTORY_PAGE);
    if (next) focusEntry(next.id);
  }
  function onEntryKey(event: ReactKeyboardEvent<HTMLLIElement>, entry: HistoryEntry) {
    if (event.target !== event.currentTarget) return;
    const action = historyKeyAction(event);
    if (!action) return;
    event.preventDefault();
    const index = visible.findIndex((e) => e.id === entry.id);
    switch (action) {
      case 'edit':
        return edit(entry);
      case 'listen':
        return speak(historyEntrySpeech(entry, speechOptions));
      case 'copy':
        return copy(entry.value);
      case 'recalculate':
        return recalculate(entry);
      case 'remove':
        return removeEntry(entry);
      case 'previous':
        return focusEntry(visible[Math.max(0, index - 1)].id);
      case 'next':
        // Al final de la página, la flecha abajo trae los siguientes.
        if (index === visible.length - 1 && filtered.length > visible.length) return showMore();
        return focusEntry(visible[Math.min(visible.length - 1, index + 1)].id);
      case 'first':
        return focusEntry(visible[0].id);
      case 'last':
        return focusEntry(visible[visible.length - 1].id);
    }
  }
  return (
    <section id="history" className="panel" aria-labelledby="history-title">
      <div className="section-heading">
        <div>
          <h2 id="history-title" tabIndex={-1}>
            Cálculos guardados en este dispositivo: <span className="count">{entries.length}</span>
          </h2>
        </div>
        <button ref={clearButton} disabled={!entries.length} onClick={() => setConfirm(true)}>
          Vaciar historial
        </button>
      </div>
      {confirm && (
        <div className="confirmation" role="group" aria-labelledby="clear-history-question">
          <p id="clear-history-question">
            ¿Eliminar todos los cálculos guardados en este dispositivo?
          </p>
          <div className="actions">
            <button
              aria-describedby="clear-history-question"
              onClick={() => {
                clear();
                setConfirm(false);
                document.getElementById('history-title')?.focus();
              }}
            >
              Sí, eliminar todos
            </button>
            <button
              autoFocus
              aria-describedby="clear-history-question"
              data-speech="¿Eliminar todos los cálculos guardados en este dispositivo? Cancelar conserva el historial."
              onClick={() => {
                setConfirm(false);
                clearButton.current?.focus();
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      <label>
        Buscar en historial
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(HISTORY_PAGE);
          }}
          placeholder="Expresión o resultado"
        />
      </label>
      <div className="actions" role="group" aria-label="Exportar historial">
        {exports.map(([format, label]) => (
          <button
            key={format}
            disabled={!entries.length}
            onClick={() => downloadHistory(entries, format)}
          >
            {label}
          </button>
        ))}
      </div>
      {!entries.length ? (
        <p className="empty">
          Tus cálculos aparecerán acá.
          <br />
          <span>Se guardan únicamente en este navegador.</span>
        </p>
      ) : !filtered.length ? (
        <p>No hay cálculos que coincidan con la búsqueda.</p>
      ) : (
        <>
          <p className="hint" id="history-keys">
            Flechas arriba y abajo recorren los cálculos; Inicio y Fin van al primero y al último.
            Enter edita, Espacio escucha, C copia el resultado, R recalcula y Suprimir elimina.
          </p>
          <p id="history-count">
            {visible.length === filtered.length
              ? filtered.length === 1
                ? '1 cálculo.'
                : `${filtered.length} cálculos.`
              : `Mostrando ${visible.length} de ${filtered.length} cálculos.`}
          </p>
          <ol className="history-list" aria-label="Cálculos">
            {visible.map((e, index) => {
              const speech = spoken.get(e.id)!;
              return (
                <li
                  key={e.id}
                  id={entryId(e.id)}
                  className="history-entry"
                  tabIndex={e.id === focusId ? 0 : -1}
                  aria-label={speech.label}
                  aria-describedby="history-keys"
                  onFocus={() => setCurrent(e.id)}
                  onKeyDown={(event) => onEntryKey(event, e)}
                >
                  <div className="history-expression">
                    <MathView
                      text={e.expression}
                      spoken={speech.expression}
                      srMath={srMath}
                      decimalSeparator={e.separator}
                      syntaxClassName="history-syntax"
                    />
                    <span aria-hidden="true">=</span>
                    <span className="sr-only">igual a</span>
                    <MathView
                      text={e.value}
                      spoken={speech.result}
                      srMath={srMath}
                      decimalSeparator={e.separator}
                      syntaxClassName="history-value"
                    />
                  </div>
                  <p className="hint">
                    <time dateTime={e.date}>{new Date(e.date).toLocaleString('es-AR')}</time> ·{' '}
                    {e.kind} · {angleNames[e.angleMode]}
                  </p>
                  <CalculationSteps steps={e.steps} speak={speak} tabbable={false} />
                  <div
                    className="actions"
                    role="group"
                    aria-label={`Acciones del cálculo ${index + 1}`}
                  >
                    <button
                      tabIndex={-1}
                      onClick={() => speak(historyEntrySpeech(e, speechOptions))}
                    >
                      Escuchar
                    </button>
                    <button tabIndex={-1} onClick={() => copy(e.value)}>
                      Copiar
                    </button>
                    <button tabIndex={-1} onClick={() => edit(e)}>
                      Editar
                    </button>
                    <button tabIndex={-1} onClick={() => recalculate(e)}>
                      Recalcular
                    </button>
                    <button tabIndex={-1} onClick={() => removeEntry(e)}>
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {filtered.length > visible.length && (
            <button onClick={showMore}>
              Mostrar {Math.min(HISTORY_PAGE, filtered.length - visible.length)} cálculos más
            </button>
          )}
        </>
      )}
    </section>
  );
}
