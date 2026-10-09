import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { focusToolField, useToolCommands } from '../keyboard/CommandContext';
import { EditHistory } from '../keyboard/EditHistory';
export interface AdvancedHandle {
  selectOperation: (operation: 'diff' | 'integrate' | 'limit') => void;
}

const operations = [
  ['solve', 'Resolver ecuación', 'x^2-5*x+6=0'],
  ['simplify', 'Simplificar', '(x^2-1)/(x-1)'],
  ['factor', 'Factorizar', 'x^2-9'],
  ['expand', 'Expandir', '(x+2)^3'],
  ['partfrac', 'Fracciones parciales', '1/(x^2-1)'],
  ['diff', 'Derivar', 'x^3'],
  ['integrate', 'Integrar', 'x^2'],
  ['limit', 'Calcular límite', 'sin(x)/x'],
  ['substitute', 'Sustituir variable', 'x^2+3*x'],
  ['system', 'Resolver sistema lineal', 'x+y=10\nx-y=4'],
  ['inequality', 'Resolver desigualdad (grado máximo 2)', 'x^2-4<=0'],
  ['series', 'Polinomio de Taylor', 'sin(x)'],
];
export function AdvancedCalculator({
  calculate,
  busy,
  ref,
}: {
  calculate: (expression: string) => void;
  busy: boolean;
  ref?: Ref<AdvancedHandle>;
}) {
  const [operation, setOperation] = useState('solve');
  const [body, setBody] = useState('x^2-5*x+6=0');
  const [variable, setVariable] = useState('x');
  const [order, setOrder] = useState('1');
  const [point, setPoint] = useState('0');
  const [limitSide, setLimitSide] = useState('both');
  const [definite, setDefinite] = useState(false);
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('5');
  const operationSelect = useRef<HTMLSelectElement>(null);
  const section = useRef<HTMLElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [editHistory] = useState(() => new EditHistory());
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    section.current
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-expression]')
      ?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [body]);
  useToolCommands('advanced', (command) => {
    if (command.type !== 'tool' || !command.operation) return;
    if (['insert', 'erase', 'delete', 'undo', 'redo'].includes(command.operation)) {
      if (command.operation === 'undo' || command.operation === 'redo') {
        const value = editHistory[command.operation](body);
        if (value !== undefined) setBody(value);
      } else {
        const field = section.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          '[data-expression]',
        );
        let start = field?.selectionStart ?? body.length;
        let end = field?.selectionEnd ?? start;
        const inserted = command.operation === 'insert' ? (command.variant ?? '') : '';
        if (start === end) {
          if (command.operation === 'erase') start = Math.max(0, start - 1);
          if (command.operation === 'delete') end = Math.min(body.length, end + 1);
        }
        const next = body.slice(0, start) + inserted + body.slice(end);
        if (next !== body) {
          editHistory.record(body);
          pendingCaret.current = start + inserted.length;
          setBody(next);
        } else {
          pendingCaret.current = null;
        }
      }
      return;
    }
    setOperation(command.operation);
    if (command.operation === 'diff') setOrder(command.variant === 'higher' ? '2' : '1');
    if (command.operation === 'integrate') setDefinite(command.variant === 'definite');
    if (command.operation === 'limit') setLimitSide(command.variant ?? 'both');
    focusToolField(section.current, '[data-expression]');
  });
  useImperativeHandle(
    ref,
    () => ({
      selectOperation(next) {
        setOperation(next);
        if (next === 'limit') setLimitSide('both');
        setBody(operations.find((op) => op[0] === next)![2]);
        operationSelect.current?.focus();
      },
    }),
    [],
  );
  return (
    <section
      ref={section}
      className="panel advanced"
      id="advanced"
      aria-labelledby="advanced-title"
    >
      <p className="eyebrow">ÁLGEBRA Y CÁLCULO</p>
      <h2 id="advanced-title">Álgebra y cálculo</h2>
      <p className="hint">
        Completá los campos; la calculadora arma la operación por vos. Las funciones simbólicas usan
        radianes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const args =
            operation === 'system'
              ? body
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
              : [body];
          if (
            [
              'solve',
              'partfrac',
              'diff',
              'integrate',
              'limit',
              'substitute',
              'inequality',
              'series',
            ].includes(operation)
          )
            args.push(variable);
          if (operation === 'diff') args.push(order);
          if (operation === 'limit') args.push(point, limitSide);
          if (operation === 'substitute') args.push(point);
          if (operation === 'integrate' && definite) args.push(lower, upper);
          if (operation === 'series') args.push(point, order);
          calculate(`${operation}(${args.join(',')})`);
        }}
      >
        <label>
          Operación simbólica
          <select
            ref={operationSelect}
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value);
              setBody(operations.find((op) => op[0] === e.target.value)![2]);
            }}
          >
            {operations.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {operation === 'system' ? 'Ecuaciones, una por línea' : 'Función o ecuación'}
          {operation === 'system' ? (
            <textarea
              data-expression
              required
              value={body}
              maxLength={400}
              rows={4}
              onChange={(e) => {
                editHistory.record(body);
                setBody(e.target.value);
              }}
              spellCheck={false}
            />
          ) : (
            <input
              data-expression
              required
              value={body}
              maxLength={400}
              onChange={(e) => {
                editHistory.record(body);
                setBody(e.target.value);
              }}
              spellCheck={false}
            />
          )}
        </label>
        <div className="advanced-fields">
          {[
            'solve',
            'partfrac',
            'diff',
            'integrate',
            'limit',
            'substitute',
            'inequality',
            'series',
          ].includes(operation) && (
            <label>
              Variable
              <input
                value={variable}
                required
                pattern="[a-df-hj-zA-Z]"
                maxLength={1}
                onChange={(e) => setVariable(e.target.value)}
              />
            </label>
          )}
          {['diff', 'series'].includes(operation) && (
            <label>
              {operation === 'series' ? 'Orden de Taylor' : 'Orden de derivada'}
              <input
                type="number"
                min={operation === 'series' ? '0' : '1'}
                max="10"
                required
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </label>
          )}
          {operation === 'limit' && (
            <label>
              Sentido del límite
              <select value={limitSide} onChange={(event) => setLimitSide(event.target.value)}>
                <option value="both">Bilateral</option>
                <option value="left">Por izquierda</option>
                <option value="right">Por derecha</option>
              </select>
            </label>
          )}
          {operation === 'limit' && (
            <label>
              Tiende a<input required value={point} onChange={(e) => setPoint(e.target.value)} />
            </label>
          )}
          {operation === 'substitute' && (
            <label>
              Reemplazar por
              <input required value={point} onChange={(e) => setPoint(e.target.value)} />
            </label>
          )}
          {operation === 'series' && (
            <label>
              Centro de Taylor
              <input required value={point} onChange={(e) => setPoint(e.target.value)} />
            </label>
          )}
        </div>
        {operation === 'integrate' && (
          <>
            <label>
              <input
                type="checkbox"
                checked={definite}
                onChange={(e) => setDefinite(e.target.checked)}
              />
              Integral definida (dominio continuo verificado)
            </label>
            {definite && (
              <div className="advanced-fields">
                <label>
                  Desde
                  <input required value={lower} onChange={(e) => setLower(e.target.value)} />
                </label>
                <label>
                  Hasta
                  <input required value={upper} onChange={(e) => setUpper(e.target.value)} />
                </label>
              </div>
            )}
          </>
        )}
        <button className="primary" type="submit" aria-disabled={busy}>
          {busy ? 'Calculando…' : 'Calcular operación'}
        </button>
      </form>
    </section>
  );
}
