import { useRef, useState } from 'react';
import { focusToolField, useToolCommands, usePreserveReaderKeys } from '../keyboard/CommandContext';
import {
  gridTarget,
  leavesCell,
  matrixCellProblem,
  matrixExpression,
  matrixOperationProblem,
  parseCell,
  parseMatrixText,
} from '../services/dataParsing';
type MatrixCells = string[][];
const cellId = (name: string, row: number, column: number) => `matrix-${name}-${row}-${column}`;
const controlId = (name: string, control: 'rows' | 'columns') => `matrix-${name}-${control}`;

function MatrixEditor({
  name,
  value,
  change,
  error,
}: {
  name: string;
  value: MatrixCells;
  change: (v: MatrixCells) => void;
  error?: { row: number; column: number; message: string } | null;
}) {
  const preservesReaderKeys = usePreserveReaderKeys();
  const [cellError, setCellError] = useState<{
    row: number;
    column: number;
    message: string;
  } | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteMessage, setPasteMessage] = useState('');
  const [pasteOptions, setPasteOptions] = useState<{ label: string; cells: string[][] }[]>([]);
  const shown = error ?? cellError;
  function resize(rows: number, columns: number) {
    change(
      Array.from({ length: rows }, (_, i) =>
        Array.from({ length: columns }, (_, j) => value[i]?.[j] ?? '0'),
      ),
    );
  }
  // Al llegar a una celda el cursor queda al final: se puede corregir sin borrar todo.
  function focusCell(row: number, column: number) {
    const input = document.getElementById(cellId(name, row, column)) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  function apply(cells: string[][]) {
    change(cells);
    setPasting(false);
    setPasted('');
    setPasteOptions([]);
    setPasteMessage('');
    requestAnimationFrame(() => focusCell(0, 0));
  }
  return (
    <fieldset>
      <legend>Matriz {name}</legend>
      <div className="field-pair">
        <label>
          Filas de {name}
          <select
            id={controlId(name, 'rows')}
            value={value.length}
            onChange={(e) => resize(+e.target.value, value[0].length)}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Columnas de {name}
          <select
            id={controlId(name, 'columns')}
            value={value[0].length}
            onChange={(e) => resize(value.length, +e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint" id={`matrix-${name}-help`}>
        Cada celda acepta números, fracciones como 1/3 y expresiones como sqrt(2)/2 o pi. Izquierda
        y derecha recorren el texto y pasan a la celda vecina desde el borde; arriba y abajo cambian
        de fila. Inicio y Fin van al principio o al final de la celda y, si ya está ahí, a la
        primera o última columna. Control más Inicio o Fin: primera o última celda.
      </p>
      <div className="matrix-scroll">
        <table className="matrix-editor">
          <caption>Valores de la matriz {name}</caption>
          <tbody>
            {value.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => {
                  const invalid = shown?.row === i && shown.column === j;
                  return (
                    <td key={j}>
                      <input
                        id={cellId(name, i, j)}
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        required
                        value={cell}
                        aria-label={`Matriz ${name}, fila ${i + 1}, columna ${j + 1}`}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? `matrix-${name}-error` : undefined}
                        onChange={(e) => {
                          if (cellError?.row === i && cellError.column === j) setCellError(null);
                          change(
                            value.map((r, k) =>
                              k === i ? r.map((c, l) => (l === j ? e.target.value : c)) : r,
                            ),
                          );
                        }}
                        onBlur={(e) => {
                          const read = parseCell(e.target.value);
                          if (!read.ok)
                            setCellError({
                              row: i,
                              column: j,
                              message: `${name}, fila ${i + 1}, columna ${j + 1}: ${read.message}.`,
                            });
                        }}
                        onKeyDown={(e) => {
                          if (preservesReaderKeys(e.nativeEvent) || e.altKey || e.shiftKey) return;
                          const input = e.currentTarget;
                          if (
                            !leavesCell(
                              e.key,
                              e.ctrlKey,
                              input.selectionStart,
                              input.selectionEnd,
                              input.value.length,
                            )
                          )
                            return;
                          const target = gridTarget(
                            e.key,
                            e.ctrlKey,
                            i,
                            j,
                            value.length,
                            value[0].length,
                          );
                          if (!target) return;
                          e.preventDefault();
                          focusCell(target.row, target.column);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown && (
        <p id={`matrix-${name}-error`} className="field-error">
          {shown.message}
        </p>
      )}
      <button
        type="button"
        aria-expanded={pasting}
        aria-controls={`matrix-${name}-paste`}
        onClick={() => setPasting(!pasting)}
      >
        Escribir o pegar la matriz {name}
      </button>
      {pasting && (
        <div id={`matrix-${name}-paste`} className="matrix-paste">
          <label htmlFor={`matrix-${name}-text`}>Matriz {name} como texto</label>
          <p className="hint" id={`matrix-${name}-text-help`}>
            Una fila por línea o separadas con punto y coma; columnas con espacios, tabulaciones o
            comas. También sirve [[1,2],[3,4]] o un rango copiado de una planilla.
          </p>
          <textarea
            id={`matrix-${name}-text`}
            rows={4}
            value={pasted}
            aria-describedby={`matrix-${name}-text-help`}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              const read = parseMatrixText(pasted, { maxRows: 6, maxColumns: 6 });
              if (read.status === 'ok') apply(read.cells);
              else if (read.status === 'error') {
                setPasteOptions([]);
                setPasteMessage(read.message);
              } else {
                setPasteMessage(read.question);
                setPasteOptions(read.options);
              }
            }}
          >
            Usar esta matriz
          </button>
          <p className="field-error" role="status">
            {pasteMessage}
          </p>
          {pasteOptions.length > 0 && (
            <div className="actions">
              {pasteOptions.map((option) => (
                <button type="button" key={option.label} onClick={() => apply(option.cells)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
  const [problem, setProblem] = useState<{
    matrix: 'A' | 'B';
    message: string;
    cell?: { row: number; column: number };
  } | null>(null);
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
  const dimensions = (cells: MatrixCells) => ({ rows: cells.length, columns: cells[0].length });
  const cellProblem = (name: 'A' | 'B') =>
    problem?.matrix === name && problem.cell ? { ...problem.cell, message: problem.message } : null;
  return (
    <section ref={section}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          // Primero el tamaño y después cada celda: el foco va al control que hay que corregir.
          const size = matrixOperationProblem(
            operation,
            dimensions(a),
            second ? dimensions(b) : undefined,
          );
          if (size) {
            setProblem({ matrix: size.matrix, message: size.message });
            requestAnimationFrame(() =>
              document.getElementById(controlId(size.matrix, size.control))?.focus(),
            );
            return;
          }
          for (const [name, cells] of [['A', a], ...(second ? [['B', b]] : [])] as [
            'A' | 'B',
            MatrixCells,
          ][]) {
            const cell = matrixCellProblem(name, cells);
            if (cell) {
              setProblem({ matrix: name, message: cell.message, cell });
              requestAnimationFrame(() => {
                const input = document.getElementById(
                  cellId(name, cell.row, cell.column),
                ) as HTMLInputElement | null;
                input?.focus();
                input?.setSelectionRange(cell.start, cell.end);
              });
              return;
            }
          }
          calculate(
            `${operation}(${matrixExpression(a)}${second ? `, ${matrixExpression(b)}` : ''})`,
          );
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
        <MatrixEditor
          name="A"
          value={a}
          change={(cells) => {
            setA(cells);
            setProblem(null);
          }}
          error={cellProblem('A')}
        />
        {second && (
          <MatrixEditor
            name="B"
            value={b}
            change={(cells) => {
              setB(cells);
              setProblem(null);
            }}
            error={cellProblem('B')}
          />
        )}
        {problem && !problem.cell && (
          <p className="field-error" role="alert">
            {problem.message}
          </p>
        )}
        <button className="primary" aria-disabled={busy}>
          Calcular matriz
        </button>
      </form>
    </section>
  );
}
