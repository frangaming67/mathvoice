import { useState } from 'react';

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
];
export function AdvancedCalculator({
  calculate,
  busy,
}: {
  calculate: (expression: string) => void;
  busy: boolean;
}) {
  const [operation, setOperation] = useState('solve');
  const [body, setBody] = useState('x^2-5*x+6=0');
  const [variable, setVariable] = useState('x');
  const [order, setOrder] = useState('1');
  const [point, setPoint] = useState('0');
  const [definite, setDefinite] = useState(false);
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('5');
  return (
    <section className="panel advanced" id="advanced" aria-labelledby="advanced-title">
      <p className="eyebrow">ÁLGEBRA Y CÁLCULO</p>
      <h2 id="advanced-title">Más allá de los números</h2>
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
          if (['solve', 'partfrac', 'diff', 'integrate', 'limit', 'substitute'].includes(operation))
            args.push(variable);
          if (operation === 'diff') args.push(order);
          if (operation === 'limit') args.push(point);
          if (operation === 'substitute') args.push(point);
          if (operation === 'integrate' && definite) args.push(lower, upper);
          calculate(`${operation}(${args.join(',')})`);
        }}
      >
        <label>
          Operación simbólica
          <select
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
              required
              value={body}
              maxLength={400}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <input
              required
              value={body}
              maxLength={400}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
            />
          )}
        </label>
        <div className="advanced-fields">
          {['solve', 'partfrac', 'diff', 'integrate', 'limit', 'substitute'].includes(
            operation,
          ) && (
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
          {operation === 'diff' && (
            <label>
              Orden de derivada
              <input
                type="number"
                min="1"
                max="10"
                required
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
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
        </div>
        {operation === 'integrate' && (
          <>
            <label>
              <input
                type="checkbox"
                checked={definite}
                onChange={(e) => setDefinite(e.target.checked)}
              />
              Integral definida (polinomios)
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
