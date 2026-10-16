import { useRef, useState, type KeyboardEvent } from 'react';
import { mathSpeech, type MathSpeechOptions } from '../accessibility/MathSpeechFormatter';
import { UNDEFINED_CELL } from '../types';

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/**
 * Tabla de valores que se recorre como la de la calculadora de mano: es una sola parada de Tab
 * y las flechas van de celda en celda. Cada celda se dice con su x y su columna, así la guía
 * por voz la lee sin lector de pantalla; con lector, es una cuadrícula con encabezados.
 */
export function ValueTable({
  headers,
  rows,
  speechOptions,
}: {
  headers: string[];
  rows: string[][];
  speechOptions: MathSpeechOptions;
}) {
  const [active, setActive] = useState({ row: 0, column: Math.min(1, headers.length - 1) });
  const grid = useRef<HTMLTableElement>(null);
  const spoken = (value: string) =>
    value === UNDEFINED_CELL ? 'no definida' : mathSpeech(value, speechOptions);
  const describe = (row: number, column: number) =>
    column === 0
      ? `equis igual a ${spoken(rows[row][0])}, fila ${row + 1} de ${rows.length}`
      : `${headers[column].replace('(x)', ' de equis')} en equis igual a ${spoken(rows[row][0])}: ${spoken(rows[row][column])}`;
  function move(row: number, column: number) {
    const next = { row: clamp(row, rows.length - 1), column: clamp(column, headers.length - 1) };
    setActive(next);
    grid.current?.querySelector<HTMLElement>(`[data-cell="${next.row}-${next.column}"]`)?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const { row, column } = active;
    const last = { row: rows.length - 1, column: headers.length - 1 };
    const target: Record<string, [number, number]> = {
      ArrowUp: [row - 1, column],
      ArrowDown: [row + 1, column],
      ArrowLeft: [row, column - 1],
      ArrowRight: [row, column + 1],
      PageUp: [row - 10, column],
      PageDown: [row + 10, column],
      Home: event.ctrlKey ? [0, column] : [row, 0],
      End: event.ctrlKey ? [last.row, column] : [row, last.column],
    };
    if (!target[event.key] || event.altKey || event.metaKey) return;
    event.preventDefault();
    move(...target[event.key]);
  }
  const cell = (row: number, column: number) => ({
    'data-cell': `${row}-${column}`,
    'data-speech': describe(row, column),
    tabIndex: row === active.row && column === active.column ? 0 : -1,
    onFocus: () => setActive({ row, column }),
  });
  return (
    <div className="result-table">
      <table
        ref={grid}
        role="grid"
        aria-readonly="true"
        aria-describedby="value-table-keys"
        className="data-table value-table"
        onKeyDown={onKeyDown}
      >
        <caption>Tabla de valores</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th scope="col" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([x, ...values], row) => (
            <tr key={row}>
              <th scope="row" {...cell(row, 0)}>
                {x}
              </th>
              {values.map((value, i) => (
                <td key={i} {...cell(row, i + 1)}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" id="value-table-keys">
        Flechas: de celda en celda. Inicio y Fin: principio y final de la fila. Control más Inicio o
        Fin: primera o última fila. Avance y Retroceso de página: de a 10 filas.
      </p>
    </div>
  );
}
