import { useRef, useState } from 'react';
import type { HistoryEntry } from '../types';
import { downloadHistory } from '../services/ExportService';
import { resultSpeech } from '../accessibility/resultSpeech';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
import { CalculationSteps } from './CalculationSteps';
export function History({
  entries,
  edit,
  recalculate,
  remove,
  clear,
  speak,
  copy,
}: {
  entries: HistoryEntry[];
  edit: (e: HistoryEntry) => void;
  recalculate: (e: HistoryEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
  speak: (text: string) => void;
  copy: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const clearButton = useRef<HTMLButtonElement>(null);
  const filtered = entries.filter((e) =>
    `${e.expression} ${e.value}`.toLowerCase().includes(query.toLowerCase()),
  );
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Expresión o resultado"
        />
      </label>
      <div className="actions" aria-label="Exportar historial">
        {(['txt', 'csv', 'json'] as const).map((format) => (
          <button
            key={format}
            disabled={!entries.length}
            onClick={() => downloadHistory(entries, format)}
          >
            Exportar {format.toUpperCase()}
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
        <ol className="history-list">
          {filtered.map((e) => (
            <li key={e.id}>
              <p className="history-expression">
                {e.expression} <strong>= {e.value}</strong>
              </p>
              <p className="hint">
                <time dateTime={e.date}>{new Date(e.date).toLocaleString('es-AR')}</time> · {e.kind}{' '}
                ·{' '}
                {e.angleMode === 'rad'
                  ? 'Radianes'
                  : e.angleMode === 'deg'
                    ? 'Grados'
                    : 'Gradianes'}
              </p>
              <CalculationSteps steps={e.steps} speak={speak} />
              <div className="actions">
                <button
                  onClick={() =>
                    speak(`${mathSpeech(e.expression)}. Resultado: ${resultSpeech(e)}`)
                  }
                  aria-label={`Escuchar cálculo ${e.expression}`}
                >
                  Escuchar
                </button>
                <button onClick={() => copy(e.value)} aria-label={`Copiar resultado ${e.value}`}>
                  Copiar
                </button>
                <button onClick={() => edit(e)} aria-label={`Editar cálculo ${e.expression}`}>
                  Editar
                </button>
                <button onClick={() => recalculate(e)} aria-label={`Recalcular ${e.expression}`}>
                  Recalcular
                </button>
                <button
                  onClick={() => {
                    remove(e.id);
                    document.getElementById('history-title')?.focus();
                  }}
                  aria-label={`Eliminar cálculo ${e.expression}`}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
