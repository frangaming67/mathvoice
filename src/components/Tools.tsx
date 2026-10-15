import { physicalConstants } from '../services/PhysicalConstants';
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
  ['mixed(', 'Mostrar número mixto'],
  ['mixedNumber(', 'Ingresar número mixto'],
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
      <h2 id="tools-title">Insertar funciones y constantes</h2>
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
          Mixtos: mixed(fraction(7,3)) muestra 2 enteros y 1/3; mixedNumber(2,1,3) ingresa ese
          número.
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
            ['Infinity', 'Infinito (para límites)'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => insert(value)}>
              {label}: {value}
            </button>
          ))}
        </div>
      </details>
      <details>
        <summary>Constantes físicas</summary>
        <p className="hint">
          Se insertan valores numéricos en unidades del SI. En expresiones compuestas, las unidades
          no se propagan automáticamente.
        </p>
        <div className="tool-grid">
          {physicalConstants.map((c) => (
            <button
              key={c.symbol}
              onClick={() => insert(c.symbol)}
              data-speech={`${c.label}, ${c.value} ${c.unit}. ${c.note}. Insertar ${c.symbol}`}
            >
              {c.label}: {c.symbol}
              <small>
                {c.value} {c.unit}. {c.note}.
              </small>
            </button>
          ))}
        </div>
        <p className="hint">
          Fuente:{' '}
          <a
            href="https://physics.nist.gov/cuu/Constants/Table/allascii.txt"
            target="_blank"
            rel="noreferrer"
          >
            NIST, CODATA 2022 (abre otra pestaña)
          </a>
          .
        </p>
      </details>
    </section>
  );
}
