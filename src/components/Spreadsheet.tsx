import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  cellName,
  cellPosition,
  COLUMNS,
  evaluateSheet,
  ROWS,
  shiftFormula,
  type CellResult,
  type Cells,
} from '../calculator/sheet';
import { readNumber } from '../calculator/display';
import { formatNumber } from '../accessibility/numberSpeech';
import { mathSpeech } from '../accessibility/MathSpeechFormatter';
import { storage } from '../services/StorageService';
import type { CalculationResult, DecimalSeparator } from '../types';

const isCells = (value: unknown): value is Cells =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.entries(value).every(
    ([name, text]) => !!cellPosition(name) && typeof text === 'string' && text.length <= 200,
  );
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
const formulaOf = (text: string) => text.trim().replace(/^=\s*/, '');

/**
 * Modo Hoja de cálculo de la calculadora de mano: cinco columnas y 45 filas. La cuadrícula se
 * recorre con flechas (una sola parada de Tab); lo que se escribe va a la línea de edición de
 * abajo, como en la pantalla real, y Enter lo guarda en la celda.
 */
export function Spreadsheet({
  evaluate,
  decimalSeparator = 'punto',
  announce,
}: {
  evaluate: (expression: string, scope: Record<string, number>) => Promise<CalculationResult>;
  decimalSeparator?: DecimalSeparator;
  announce: (text: string) => void;
}) {
  const [cells, setCells] = useState<Cells>(() => storage.read('sheet', {}, isCells));
  const [results, setResults] = useState<Record<string, CellResult>>({});
  const [active, setActive] = useState({ row: 0, column: 0 });
  const [draft, setDraft] = useState<string | null>(null);
  const [fillTo, setFillTo] = useState('');
  const grid = useRef<HTMLTableElement>(null);
  const editor = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const spokenAfter = useRef<string | null>(null);
  const name = cellName(active.row, active.column);

  const shown = (cell: string, from = results) => {
    if (!cells[cell]) return '';
    const result = from[cell];
    if (!result) return '…';
    return result.number !== undefined
      ? formatNumber(result.number, { significant: 10, decimal: decimalSeparator })
      : result.text;
  };
  const spoken = (cell: string, from = results) => {
    const content = cells[cell];
    if (!content) return `${cell}: vacía`;
    const result = from[cell];
    const value = !result
      ? 'calculando'
      : result.error
        ? `error. ${result.error.replace(/\.$/, '')}`
        : mathSpeech(shown(cell, from), { decimalSeparator });
    const formula = formulaOf(content);
    return readNumber(formula, decimalSeparator) === null
      ? `${cell}: ${value}. Fórmula: ${mathSpeech(formula, { decimalSeparator })}`
      : `${cell}: ${value}`;
  };

  // Cada cambio recalcula la hoja con el motor de la calculadora; un cálculo viejo se descarta.
  useEffect(() => {
    const id = ++version.current;
    void evaluateSheet(
      cells,
      async (expression, scope) => {
        const result = await evaluate(expression, scope);
        const number = readNumber(result.value, result.separator ?? 'punto');
        return number === null ? { text: result.value } : { text: result.value, number };
      },
      decimalSeparator,
      () => id === version.current,
    ).then((next) => {
      if (!next) return;
      setResults(next);
      if (spokenAfter.current) announce(spoken(spokenAfter.current, next));
      spokenAfter.current = null;
    });
    // spoken lee las celdas de este mismo cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, decimalSeparator, evaluate]);

  function save(next: Cells) {
    setCells(next);
    if (!storage.write('sheet', next)) announce('No se pudo guardar la hoja en este navegador.');
  }
  function commit(text: string) {
    const value = text.trim();
    const next = { ...cells };
    if (value) next[name] = value;
    else delete next[name];
    setDraft(null);
    if (value === (cells[name] ?? '')) return;
    spokenAfter.current = name;
    save(next);
  }
  function focusCell(row: number, column: number) {
    const next = { row: clamp(row, ROWS - 1), column: clamp(column, COLUMNS.length - 1) };
    setActive(next);
    setDraft(null);
    grid.current
      ?.querySelector<HTMLElement>(`[data-cell="${cellName(next.row, next.column)}"]`)
      ?.focus();
  }
  function edit(start?: string) {
    setDraft(start ?? cells[name] ?? '');
    // El foco pasa ya a la línea de edición: lo que se siga escribiendo llega ahí.
    editor.current?.focus();
    requestAnimationFrame(() => {
      const field = editor.current;
      field?.setSelectionRange(field.value.length, field.value.length);
    });
  }
  function onGridKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (event.altKey || event.metaKey) return;
    const { row, column } = active;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [row - 1, column],
      ArrowDown: [row + 1, column],
      ArrowLeft: [row, column - 1],
      ArrowRight: [row, column + 1],
      PageUp: [row - 10, column],
      PageDown: [row + 10, column],
      Home: event.ctrlKey ? [0, 0] : [row, 0],
      End: event.ctrlKey ? [ROWS - 1, COLUMNS.length - 1] : [row, COLUMNS.length - 1],
    };
    if (moves[event.key]) {
      event.preventDefault();
      focusCell(...moves[event.key]);
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      edit();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (cells[name]) {
        commit('');
        announce(`${name} vacía.`);
      }
    } else if (event.key.length === 1 && !event.ctrlKey) {
      // Escribir sobre una celda empieza a editarla, como en cualquier planilla.
      event.preventDefault();
      edit(event.key);
    }
  }
  function fillDown() {
    const content = cells[name];
    const last = Number(fillTo) - 1;
    if (!content) return announce(`${name} está vacía: no hay nada para copiar.`);
    if (!Number.isInteger(last) || last <= active.row || last >= ROWS)
      return announce(`Elegí una fila entre ${active.row + 2} y ${ROWS}.`);
    const next = { ...cells };
    for (let row = active.row + 1; row <= last; row++) {
      const copied = shiftFormula(content, row - active.row);
      if (copied === null)
        return announce('Al copiar, una referencia quedaría fuera de la hoja. No se copió nada.');
      next[cellName(row, active.column)] = copied;
    }
    save(next);
    announce(`${name} copiada hasta ${cellName(last, active.column)}.`);
  }
  function clearSheet() {
    if (!Object.keys(cells).length) return announce('La hoja ya está vacía.');
    if (!window.confirm('¿Borrar todas las celdas de la hoja?')) return;
    save({});
    announce('Hoja borrada.');
  }

  return (
    <section className="sheet">
      <div className="result-table">
        <table
          ref={grid}
          role="grid"
          aria-describedby="sheet-keys"
          className="data-table sheet-table"
          onKeyDown={onGridKeyDown}
        >
          <caption>Hoja de cálculo</caption>
          <thead>
            <tr>
              <td />
              {COLUMNS.map((column) => (
                <th scope="col" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, row) => (
              <tr key={row}>
                <th scope="row">{row + 1}</th>
                {COLUMNS.map((_, column) => {
                  const cell = cellName(row, column);
                  return (
                    <td
                      key={cell}
                      data-cell={cell}
                      data-speech={spoken(cell)}
                      data-error={results[cell]?.error ? '' : undefined}
                      tabIndex={row === active.row && column === active.column ? 0 : -1}
                      onFocus={() => {
                        if (row !== active.row || column !== active.column) setDraft(null);
                        setActive({ row, column });
                      }}
                      onDoubleClick={() => edit()}
                    >
                      {shown(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" id="sheet-keys">
        Flechas: de celda en celda. Escribí para cambiar la celda elegida, o Enter para editarla;
        Suprimir la vacía. Control más Inicio o Fin: primera o última celda.
      </p>
      <div className="sheet-editor">
        <label htmlFor="sheet-editor">Contenido de {name}</label>
        <input
          id="sheet-editor"
          ref={editor}
          value={draft ?? cells[name] ?? ''}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-describedby="sheet-editor-help"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(draft ?? cells[name] ?? '');
              focusCell(active.row + (event.shiftKey ? -1 : 1), active.column);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              focusCell(active.row, active.column);
              announce('Edición cancelada.');
            }
          }}
        />
        <p className="hint" id="sheet-editor-help">
          Un número o una fórmula: A1*2, suma(A1:A5), promedio(B1:B10), mínimo, máximo o cualquier
          cuenta de la calculadora. Enter guarda y baja; Escape cancela.
          {results[name]?.error && ` ${name}: ${results[name].error}`}
        </p>
      </div>
      <div className="actions">
        <label>
          Copiar {name} hacia abajo hasta la fila
          <input
            type="number"
            min={active.row + 2}
            max={ROWS}
            value={fillTo}
            onChange={(event) => setFillTo(event.target.value)}
          />
        </label>
        <button type="button" onClick={fillDown}>
          Copiar hacia abajo
        </button>
        <button type="button" onClick={clearSheet}>
          Borrar la hoja
        </button>
      </div>
    </section>
  );
}
