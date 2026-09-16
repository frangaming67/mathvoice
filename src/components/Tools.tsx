const basic = [
  ['(', 'Abrir paréntesis'],
  [')', 'Cerrar paréntesis'],
  ['+', 'Sumar'],
  ['-', 'Restar'],
  ['*', 'Multiplicar'],
  ['/', 'Dividir'],
  ['^2', 'Al cuadrado'],
  ['%', 'Porcentaje'],
  ['abs(', 'Valor absoluto'],
  ['fraction(', 'Fracción'],
];
const scientific = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'exp',
  'sqrt',
  'cbrt',
  'factorial',
  'mod',
  'floor',
  'ceil',
  'round',
  'abs',
  'sign',
  'gcd',
  'lcm',
];
export function Tools({ insert }: { insert: (value: string) => void }) {
  return (
    <section aria-labelledby="tools-title" className="panel">
      <p className="eyebrow">A TU RITMO</p>
      <h2 id="tools-title">Más herramientas</h2>
      <details>
        <summary>Básica</summary>
        <div className="tool-grid">
          {basic.map(([value, label]) => (
            <button key={value} onClick={() => insert(value)}>
              {label} <span aria-hidden="true">{value}</span>
            </button>
          ))}
        </div>
        <p className="hint">
          Porcentaje: 25% = 0.25. Cambiá el signo con − delante de un número o de un paréntesis.
        </p>
      </details>
      <details>
        <summary>Científica</summary>
        <div className="tool-grid">
          {scientific.map((fn) => (
            <button key={fn} onClick={() => insert(`${fn}(`)} aria-label={`Insertar ${fn}`}>
              {fn}
            </button>
          ))}
        </div>
        <p className="hint">
          log(100) = 2 · ln(e) = 1 · log(8,2) = 3. Completá el argumento y cerrá el paréntesis.
        </p>
      </details>
      <details>
        <summary>Constantes matemáticas</summary>
        <div className="actions">
          {[
            ['pi', 'Pi'],
            ['e', 'Número de Euler'],
            ['phi', 'Proporción áurea'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => insert(value)}>
              {label}: {value}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
