import { useRef, useState } from 'react';
import { focusToolField, useToolCommands, usePreserveReaderKeys } from '../keyboard/CommandContext';
type MatrixCells = string[][];
function MatrixEditor({
  name,
  value,
  change,
}: {
  name: string;
  value: MatrixCells;
  change: (v: MatrixCells) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[][]>([]);
  const preservesReaderKeys = usePreserveReaderKeys();
  function resize(rows: number, columns: number) {
    change(
      Array.from({ length: rows }, (_, i) =>
        Array.from({ length: columns }, (_, j) => value[i]?.[j] ?? '0'),
      ),
    );
  }
  return (
    <fieldset>
      <legend>Matriz {name}</legend>
      <div className="field-pair">
        <label>
          Filas de {name}
          <select value={value.length} onChange={(e) => resize(+e.target.value, value[0].length)}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Columnas de {name}
          <select value={value[0].length} onChange={(e) => resize(value.length, +e.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">
        Flechas: moverte entre celdas. Inicio y Fin: primera y última columna. Control más Inicio o
        Fin: primera o última celda. Tab continúa al siguiente control.
      </p>
      <div className="matrix-scroll">
        <table className="matrix-editor">
          <caption>Valores de la matriz {name}</caption>
          <tbody>
            {value.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>
                    <input
                      type="number"
                      step="any"
                      required
                      value={cell}
                      aria-label={`Matriz ${name}, fila ${i + 1}, columna ${j + 1}, valor ${cell || 'vacío'}`}
                      ref={(el) => {
                        refs.current[i] ??= [];
                        refs.current[i][j] = el;
                      }}
                      onChange={(e) =>
                        change(
                          value.map((r, k) =>
                            k === i ? r.map((c, l) => (l === j ? e.target.value : c)) : r,
                          ),
                        )
                      }
                      onKeyDown={(e) => {
                        if (preservesReaderKeys(e.nativeEvent) || e.altKey || e.shiftKey) return;
                        if (e.key === 'Home' || e.key === 'End') {
                          e.preventDefault();
                          const row = e.ctrlKey ? (e.key === 'Home' ? 0 : value.length - 1) : i;
                          refs.current[row]?.[e.key === 'Home' ? 0 : value[0].length - 1]?.focus();
                          return;
                        }
                        if (e.ctrlKey) return;
                        const moves: Record<string, number[]> = {
                          ArrowLeft: [0, -1],
                          ArrowRight: [0, 1],
                          ArrowUp: [-1, 0],
                          ArrowDown: [1, 0],
                        };
                        const move = moves[e.key];
                        if (move) {
                          e.preventDefault();
                          refs.current[i + move[0]]?.[j + move[1]]?.focus();
                        }
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}
export function MatrixCalculator({
  calculate,
  busy,
}: {
  calculate: (e: string) => void;
  busy: boolean;
}) {
  const [a, setA] = useState<MatrixCells>([
    ['1', '2'],
    ['3', '4'],
  ]);
  const [b, setB] = useState<MatrixCells>([
    ['1', '0'],
    ['0', '1'],
  ]);
  const [operation, setOperation] = useState('det');
  const section = useRef<HTMLElement>(null);
  useToolCommands('matrices', (command) => {
    if (command.type !== 'tool') return;
    if (command.operation && command.operation !== 'new') setOperation(command.operation);
    focusToolField(
      section.current,
      command.operation === 'new' ? 'fieldset select' : 'table input',
    );
  });
  const second = ['add', 'subtract', 'multiply', 'lusolve'].includes(operation);
  const serialize = (cells: MatrixCells) => JSON.stringify(cells.map((row) => row.map(Number)));
  return (
    <section ref={section} aria-labelledby="matrix-title">
      <h2 id="matrix-title" tabIndex={-1}>
        Matrices
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate(`${operation}(${serialize(a)}${second ? `,${serialize(b)}` : ''})`);
        }}
      >
        <label>
          Operación matricial
          <select value={operation} onChange={(e) => setOperation(e.target.value)}>
            {[
              ['det', 'Determinante'],
              ['inv', 'Inversa'],
              ['transpose', 'Transpuesta'],
              ['rank', 'Rango'],
              ['trace', 'Traza'],
              ['eigvals', 'Autovalores'],
              ['eigvecs', 'Autovectores'],
              ['add', 'A + B'],
              ['subtract', 'A − B'],
              ['multiply', 'A × B'],
              ['lusolve', 'Resolver A × X = B'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <MatrixEditor name="A" value={a} change={setA} />
        {second && <MatrixEditor name="B" value={b} change={setB} />}
        <button className="primary" aria-disabled={busy}>
          Calcular matriz
        </button>
      </form>
    </section>
  );
}
